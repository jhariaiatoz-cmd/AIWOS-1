# Dashboard Command — "Network Error" Root-Cause Report

Scope: end-to-end trace of `CommandHero.tsx → lib/api/conversations.ts → conversations.py
→ conversation_service.py`. Audit only — no files modified, no commits made.
Date: 2026-06-16

---

## 1. The exact request being sent

`CommandHero.tsx:24-31`:

```ts
mutationFn: async (prompt: string) => {
  if (!currentOrgId) throw new Error("No organization found.");
  const conv = await conversationApi.create({
    organization_id: currentOrgId,
    user_id: user?.id,
    prompt,
  });
  return conv.id;
},
```

`lib/api/conversations.ts:46-49`:

```ts
create: (body: ConversationCreate) =>
  apiClient.post<ConversationResponse>("/conversations", body).then((r) => r.data),
```

Resolved HTTP call (`lib/api/client.ts:3-9`):

```
POST {NEXT_PUBLIC_API_URL}/conversations
  = POST http://localhost:8000/api/v1/conversations
Headers: Content-Type: application/json, Authorization: Bearer <aiwos-token>
Body: { "organization_id": "<uuid>", "user_id": "<uuid>", "prompt": "<text>" }
```

No `timeout` is set on the axios instance (`client.ts:6-9`), so axios will wait
indefinitely for a response — it never times out on its own.

---

## 2. Required logging (not yet implemented — recommended insertion points)

| Field | Where to log it | Line |
|---|---|---|
| `organization_id`, `user_id`, `prompt`, full payload | `CommandHero.tsx`, just before `conversationApi.create(...)` | `CommandHero.tsx:26` |
| Raw axios error (`error.message`, `error.code`, `error.response?.status`, `error.response?.data`) | `client.ts` response interceptor, before the 401 branch | `client.ts:25` |
| Inbound `organization_id`/`user_id`/`prompt` + resolved `current_user.id` | `create_conversation` route handler | `conversations.py:22-30` |
| Agent routing decision | already logged via `log_routing()` | `conversation_service.py:131` |
| LLM call success/failure + exception text | `_call_llm` | `conversation_service.py:90-104` |

None of this logging exists today — `_call_llm` swallows exceptions into a string
(`conversation_service.py:104`) instead of logging them, so a failed LLM call is
currently invisible server-side.

---

## 3. What "Network Error" actually means here

Axios only produces the literal string `"Network Error"` when `error.response` is
`undefined` — i.e. **no HTTP response was ever received** (connection refused, DNS
failure, CORS block, or the connection was torn down mid-flight). Any real HTTP
response from FastAPI — 401, 422, 500 — surfaces in axios as
`"Request failed with status code NNN"`, not `"Network Error"`. This distinction lets
us rule out most of the requested candidate causes directly from the code:

| Candidate cause | Verdict | Evidence |
|---|---|---|
| Missing `organization_id` | **Ruled out** | Caught client-side at `CommandHero.tsx:25` before any request is sent — throws `Error("No organization found.")`, a different message, not "Network Error". |
| Missing `user_id` | **Ruled out** | `user_id` is `Optional` on both the TS type (`conversations.ts:39`) and the Pydantic schema (`schemas/conversation.py:38`); the route injects `current_user.id` if omitted (`conversations.py:28-29`). Never causes a failed request. |
| Authentication | **Ruled out** | Missing/invalid token → FastAPI returns 401/403 with a real HTTP response (`dependencies.py:24-47`). Axios reports `"Request failed with status code 401"`, and the 401 interceptor (`client.ts:23-39`) handles it — does not produce "Network Error". |
| Agent routing | **Ruled out** | No matching agents → `HTTPException(422, ...)` (`conversation_service.py:126-136`), a real HTTP response, not "Network Error". |
| Conversation creation (DB) | **Unlikely, but not zero** | A DB error mid-`db.commit()` raises an unhandled exception → Starlette's default exception handler still returns a 500 response in almost all cases. Only a hard process crash or dropped TCP connection to the remote Supabase pooler (`DATABASE_URL` → `aws-1-ap-south-1.pooler.supabase.com`) would sever the connection before any response is sent. |
| **LLM execution** | **Root cause** | See §4. |

---

## 4. Root cause

**File:** `aiwos-backend/app/services/conversation_service.py`
**Exact failing line:** line 91 — `response = await llm_complete(model=model, system_prompt=system_prompt, user_prompt=user_prompt)`, called synchronously from `create_conversation()` (line 160) inside the same request/response cycle that the frontend is waiting on.

**Contributing lines (no timeout anywhere in the chain):**
- `llm_provider_service.py:80` — `AsyncOpenAI(api_key=...)` — no `timeout=`
- `llm_provider_service.py:103` — `anthropic.AsyncAnthropic(api_key=...)` — no `timeout=`
- `llm_provider_service.py:125` — `google_genai.Client(api_key=...)` — no `timeout=`
- `lib/api/client.ts:6-9` — axios instance has no `timeout` either

**Mechanism:**
1. `POST /conversations` with a `prompt` triggers a **synchronous** LLM call before the HTTP response can be sent (`conversation_service.py:159-167`).
2. Every seeded agent uses `gemini-2.5-flash` (confirmed in the prior audit, §4 of `audit_report.md`), so in practice this is a live network call to Google's Gemini API on every dashboard command.
3. None of the three SDK clients have a timeout configured. The OpenAI/Anthropic SDKs default to ~10 minutes; the Gemini SDK has no explicit cap either.
4. If that outbound call to the LLM provider is slow, rate-limited-but-stalling, or experiences a transient network blip, the FastAPI worker holds the request open for an unbounded period.
5. The browser (and/or any intermediary — devcontainer/Codespaces port forwarding, corporate proxy, OS socket idle limits) eventually kills the long-idle TCP connection **before FastAPI ever sends a response**.
6. Axios on the client never receives `error.response` — only `error.request` — so it falls back to the generic `error.message = "Network Error"`, which `CommandHero.tsx:39` displays verbatim: `err instanceof Error ? err.message : "Something went wrong."`.
7. This explains the **intermittency**: it only happens when the LLM round-trip is unusually slow, not on every request — matching "sometimes shows Network Error" exactly. A fast Gemini response (the common case) returns well within any timeout window and never exhibits the bug.

**Exact exception:** there is no single exception object on the backend, because the backend never errors out — it's still mid-`await` when the client gives up. Client-side, the only artifact is:
```
AxiosError: Network Error
  code: "ERR_NETWORK"
  response: undefined
```

On the rare run where the backend's own LLM call *does* throw (e.g. real timeout from the provider SDK), it's caught at `conversation_service.py:103` and turned into a chat message (`"I encountered an error: {exc}"`) with a `201 Created` response — that path is silent and does **not** produce "Network Error"; it's a separate, already-documented bug (see `audit_report.md` F4/F5).

**Confidence: Medium-High.** The architectural defect (synchronous, unbounded, un-timed-out LLM call inside the request path) is directly confirmed by reading the code — there is no other code path between these four files capable of producing a response-less failure under normal operation. What is not directly observed in this audit (no live traffic capture was performed) is the specific intermediary that severs the connection (browser tab throttling, Codespaces port-forward idle timeout, or OS-level socket timeout) — any of these would produce the identical symptom, and which one applies depends on how the app is being accessed.

---

## 5. Recommended fix

1. **Add a request-level timeout to the LLM call**, e.g. wrap `llm_complete(...)` in `asyncio.wait_for(..., timeout=20)` inside `_call_llm` (`conversation_service.py:91`), and treat a timeout as a normal caught exception (already has a `try/except` at line 90/103) so the endpoint always returns promptly with a real HTTP response instead of hanging.
2. **Add `timeout=` to each SDK client constructor** (`llm_provider_service.py:80,103,125`) so a slow provider can't hold the connection open for minutes.
3. **Add a client-side axios timeout** (`client.ts:6-9`, e.g. `timeout: 30000`) so the frontend fails fast with a clear, actionable message ("Request timed out — try again") instead of the opaque "Network Error" after an indefinite wait.
4. Longer-term (already flagged in `audit_report.md`): make conversation creation return immediately (202-style) and run the LLM call as a background task, polling/streaming the result — this removes the synchronous LLM call from the request path entirely, which is the actual structural fix rather than just bounding the symptom.
