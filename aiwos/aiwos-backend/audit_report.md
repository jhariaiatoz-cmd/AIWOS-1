# AIWOS LLM Provider Audit Report

Scope: `aiwos-backend`. Audit only — no files modified, no commits made.
Date: 2026-06-16

---

## 1. Environment Loading

**Config source:** `app/core/config.py` — `Settings(BaseSettings)`, loads from
`aiwos-backend/.env` (path resolved relative to `config.py`, not CWD).

| Variable | Present in `.env` | Loaded into `settings` | Notes |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes (`OPENAI_API_KEY=...`) | ✅ Yes | Correct casing |
| `ANTHROPIC_API_KEY` | Yes (`ANTHROPIC_API_KEY=...`) | ✅ Yes | Correct casing |
| `GEMINI_API_KEY` | Yes, but written as **`Gemini_API_KEY=...`** | ✅ Yes (loads anyway) | See finding F1 |

**Verification performed:**
```python
from app.core.config import settings
settings.OPENAI_API_KEY    # truthy
settings.ANTHROPIC_API_KEY # truthy
settings.GEMINI_API_KEY    # truthy — value starts "AQ.Ab8RN6J..."
```
All three keys resolve to non-empty values at runtime. **Initialization succeeds** — `pydantic-settings` defaults to `case_sensitive=False` (not explicitly set in `Settings.model_config`), so the mis-cased `Gemini_API_KEY` line in `.env` still binds to the `GEMINI_API_KEY` field. This is incidental, not by design.

### Findings

- **F1 — Inconsistent env var casing (works by accident).** `.env` line 18 is `Gemini_API_KEY=...` while the other two keys are written in full uppercase (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). It only works because `case_sensitive` was never explicitly set to `True`. If anyone hardens config later (e.g. `case_sensitive=True` for stricter validation), Gemini silently breaks with no error — `settings.GEMINI_API_KEY` would just be `None`, and every Gemini-routed call would raise `ValueError("GEMINI_API_KEY is not configured")` at call time, not at startup.
- **F2 — `.env.example` documents zero LLM provider keys.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` are completely absent from `.env.example`. A new developer following the example file would never know these keys are required, and would only discover it when an agent conversation fails at runtime.
- **No startup validation.** `Settings` has no validator that checks any provider key is present. The app boots fine with all three keys missing — the failure only surfaces on the first LLM call (see §5).

---

## 2. Provider Service Audit — `app/services/llm_provider_service.py`

**Supported providers:** OpenAI, Anthropic, Gemini (Google Gen AI SDK).

**Provider selection logic:** purely by **model name string prefix** — there is no provider field consulted anywhere in this file.

```python
def complete(model, system_prompt, user_prompt):
    if model.startswith("gpt-"):    → _complete_openai
    if model.startswith("claude-"): → _complete_anthropic
    if model.startswith("gemini-"): → _complete_gemini
    else: raise ValueError("Unknown model ...")
```

**Default provider:** none at this layer. The *caller* supplies a default model string (`_FALLBACK_MODEL = "gemini-2.5-flash"` in `conversation_service.py`, `_DEFAULT_MODEL = "gemini-2.5-flash"` in `execution_service.py`), used only when `agent.model` is null. Both callers default to Gemini.

**Fallback behavior:** **none.** If the selected provider call fails (bad key, timeout, quota, network error), there is no retry and no fallback to a different provider or model. The exception propagates straight to the caller.

**Error handling in this file:**
- Missing key → raises a plain `ValueError` with a descriptive message, *before* any network call (cheap fail).
- Any SDK-level error (auth, rate limit, timeout, malformed response) is **not caught here** — it propagates unmodified to the caller.
- Unknown model prefix → `ValueError`.

### Findings

- **F3 — `Agent.provider` column is persisted but never read.** The `agents` table has a `provider` column (`app/models/agent.py:57`), and `provisioning_service.py` seeds every agent with `"provider": "gemini"`. But `complete()` never inspects `agent.provider` — it only looks at the model string prefix. **The `provider` field is dead data.** If an operator edits an agent's `provider` to `"openai"` without also changing `model` to a `gpt-*` string, nothing changes — the system keeps calling Gemini. This is a latent UX/data-integrity bug: the field implies control it doesn't have.
- **F4 — No circuit breaker, retry, or fallback chain.** A transient failure (timeout, momentary rate limit) on the chosen provider has no recovery path — it fails the request/execution outright every time, even though a fallback to a second provider or a retry-with-backoff would be straightforward to add given the existing prefix-routing design.
- **F5 — No per-provider timeout configured.** All three SDK clients (`AsyncOpenAI`, `anthropic.AsyncAnthropic`, `google_genai.Client`) are instantiated with only an API key — no `timeout=` override. They rely on SDK defaults (OpenAI/Anthropic default ~10 minutes). A slow provider can hold a request open far longer than a typical HTTP gateway timeout would allow, with no app-level cutoff.

---

## 3. Agent Execution Flow — Traced

Two distinct entry points were traced, both converging on the same provider service.

### Path A — Dashboard prompt → conversation

```
CommandHero.tsx (frontend)
  └─ POST /conversations  { organization_id, user_id, prompt }
       └─ app/api/v1/endpoints/conversations.py: create_conversation()
            └─ app/services/conversation_service.py: create_conversation()
                 ├─ app/services/agent_router.py: route(agents, prompt)
                 │     → keyword/phrase scoring picks ONE Agent row from the org's
                 │       existing agents (HR / Research / Sales / Finance / Marketing /
                 │       Support / Engineering tiers). This step never touches providers —
                 │       it only selects *which agent* (and thus which agent.model) answers.
                 └─ _append_message_pair()
                      └─ _call_llm(agent, user_prompt)
                           model = agent.model or "gemini-2.5-flash"   # fallback
                           └─ llm_provider_service.complete(model, system_prompt, user_prompt)
                                └─ dispatches by prefix to OpenAI / Anthropic / Gemini
```

**Exact provider called:** whichever provider matches `agent.model`'s prefix for the agent the router selected. Since every seeded agent currently has `model = "gemini-2.5-flash"` (see §4), **every dashboard prompt today resolves to Gemini**, regardless of which agent the router picks.

**Error containment:** `_call_llm` wraps the provider call in try/except and **never raises** — on failure it returns the string `"I encountered an error: {exc}"` as the agent's chat message content, with `payload=None`. The HTTP response is still `201 Created`; the failure is only visible by reading the message text. No error status code, no retry.

### Path B — Task execution (workflow/task runner)

```
app/services/execution_service.py: run_execution(execution_id)
  ├─ _resolve_agent()           # execution.agent_id or task.assigned_to
  ├─ _build_system_prompt(agent) / _build_user_prompt(task)
  ├─ model = agent.model or "gemini-2.5-flash"
  └─ llm_provider_service.complete(model, system_prompt, user_prompt)
       ├─ success → execution.status = "completed", cost/tokens recorded, task.status = "Done"
       └─ exception → execution.status = "failed", error_message = str(exc),
                       ExecutionLog row written with status="failed"
```

Unlike Path A, this path **does** record failures distinctly (`status="failed"` + `error_message`), but still has no retry or provider fallback — one attempt only.

---

## 4. Agent → Provider Mapping

**Current reality: there is no differentiated mapping.** Every agent seeded by `app/services/provisioning_service.py` is hardcoded to Gemini:

| Agent | `provider` field | `model` field | Effective provider (by model prefix) |
|---|---|---|---|
| Full Stack Engineer | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Backend Engineer | `gemini` | `gemini-2.5-flash` | **Gemini** |
| UI/UX Designer | `gemini` | `gemini-2.5-flash` | **Gemini** |
| HR Manager | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Sales Manager | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Marketing Strategist | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Research Analyst | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Support Specialist | `gemini` | `gemini-2.5-flash` | **Gemini** |
| Finance Manager | `gemini` | `gemini-2.5-flash` | **Gemini** |

The example mapping in the audit request (Research Analyst → Gemini, Full Stack Engineer → OpenAI, HR Manager → Gemini, Finance Manager → OpenAI) **does not exist in the codebase today**. No code path varies the model/provider by role, department, or task type. OpenAI is fully wired and functional (see §1, §5) but currently **unused by any seeded agent** — it only activates if an operator manually edits an `agent.model` value to a `gpt-*` string via the agents API/UI.

---

## 5. Failure Testing — Actual Behavior Observed

All tests below were run directly against `llm_provider_service.complete()` in this environment (no files modified).

| Scenario | Method | Actual behavior observed |
|---|---|---|
| **Missing Gemini key** | Verified real env: key is present (just mis-cased — see F1). True missing-key state not natively reproducible without editing `.env`, so simulated by clearing `settings.GEMINI_API_KEY` in-process before calling `complete("gemini-2.5-flash", ...)`. | `_complete_gemini` raises `ValueError("GEMINI_API_KEY is not configured")` **before** any network call. No retry, no fallback provider. In Path A this becomes the chat message `"I encountered an error: GEMINI_API_KEY is not configured"`; in Path B the execution row is marked `"failed"` with that exact `error_message`. |
| **Missing OpenAI key** | Cleared `settings.OPENAI_API_KEY` in-process, called `complete("gpt-4o-mini", ...)`. | Identical pattern: `ValueError("OPENAI_API_KEY is not configured")` raised pre-network-call. Same downstream handling as above. |
| **Provider timeout** | Not live-tested (would require an artificial network delay / mock; out of scope for a no-modification audit). Assessed from code. | No timeout is configured on any client (`AsyncOpenAI()`, `anthropic.AsyncAnthropic()`, `google_genai.Client()` are all constructed with only `api_key=`). A hang relies entirely on SDK defaults (OpenAI/Anthropic ≈10 min). When/if it does time out, the SDK's own timeout exception bubbles up through `complete()` uncaught, and is caught only at the call site (`_call_llm` / `run_execution`) as a generic `Exception` — surfaced as an inline chat error string (Path A, still `201 Created`) or `status="failed"` (Path B). No retry, no shorter app-level cutoff. |
| **Provider quota exceeded** | Not live-tested (intentionally avoided — would require exhausting real quota or a mocked SDK error, both out of scope for a read-only audit). Assessed from code. | Same swallow-and-stringify pattern: the SDK's rate-limit/quota exception (e.g. `openai.RateLimitError`, Google's `ResourceExhausted`) is not pattern-matched anywhere in this codebase — it's caught by the same bare `except Exception` in `_call_llm`/`run_execution` and rendered as `f"I encountered an error: {exc}"` or `error_message=str(exc)`. The end user/operator sees a generic error string, not a distinguishable "quota exceeded, try later" signal, and the system does not automatically fall back to a different provider even though one is fully configured and available. |

**Common pattern across all four scenarios:** every failure mode — missing key, timeout, or quota — is handled identically and generically. There is no error taxonomy, no distinction between "fix your config" (missing key) and "wait and retry" (rate limit/timeout) errors anywhere above the raw exception string.

---

## 6. Recommendations

See `architecture_diagram.md` for the current-state diagram.

### Problems found (ranked by impact)

1. **No real multi-provider strategy exists** — despite three fully-functional, correctly-keyed providers, 100% of traffic goes to Gemini because every seeded agent's `model` is `gemini-2.5-flash`. OpenAI and Anthropic integrations are correct but dormant.
2. **`Agent.provider` is a dead field** — stored, displayed (presumably in UI), seeded, but never consulted by the routing logic. Risk of operator confusion: changing it has zero effect.
3. **No fallback on provider failure** — a single provider outage/quota exhaustion fails every task/conversation routed to it, even though switching to another already-configured provider is one function call away.
4. **Generic error handling** — missing-key, timeout, and quota errors are indistinguishable to the end user and to logs/metrics; no error-type tagging on `ExecutionLog`/`Message.payload`.
5. **Config fragility** — `Gemini_API_KEY` casing in `.env` works only because of an implicit pydantic-settings default; `.env.example` doesn't mention any of the three keys.
6. **No startup-time key validation** — failures only surface on first use, not at boot, making misconfiguration harder to catch in CI/deploy.

### Exact fixes required

1. In `llm_provider_service.py`, make `complete()` accept and actually use `provider` (not just infer from model prefix), or at minimum validate `agent.provider` matches the model prefix and log/raise on mismatch — eliminates F3's dead field.
2. Add a `fallback_model` (or ordered list) per agent, and in `_call_llm` / `run_execution`, catch provider-specific exceptions and retry once against the fallback model/provider before giving up.
3. Differentiate exception types in `_complete_openai` / `_complete_anthropic` / `_complete_gemini` — wrap SDK-specific auth/rate-limit/timeout exceptions into a small internal exception hierarchy (`ProviderAuthError`, `ProviderRateLimitError`, `ProviderTimeoutError`) so callers can branch (retry vs. fail-fast vs. surface a specific user-facing message).
4. Fix `.env` key casing to `GEMINI_API_KEY` (cosmetic now, load-bearing later) and add all three provider keys to `.env.example` with comments.
5. Add an explicit timeout (e.g. 30–60s) to each provider client constructor so a hung provider can't stall a request indefinitely.
6. Add a lightweight startup check (not a hard failure, a warning log) listing which provider keys are configured, so missing keys are visible in deploy logs instead of only at first use.

### Recommended provider strategy for AIWOS Workforce

Adopt **per-agent-role provider assignment**, since the routing/agent infrastructure already supports a `model` string per agent — no schema change needed, only seed-data and policy changes:

- **Reasoning/research-heavy roles** (Research Analyst, Marketing Strategist, Support Specialist) → Gemini 2.5 Flash (cheap, fast, good for high-volume drafting/lookup tasks).
- **Code-generation roles** (Full Stack Engineer, Backend Engineer, UI/UX Designer) → a stronger coding-tuned model (OpenAI `gpt-4o` or Anthropic `claude-sonnet-4-6`) where correctness matters more than per-call cost.
- **Numerically/compliance-sensitive roles** (Finance Manager, HR Manager) → Anthropic or OpenAI's higher-tier models, favoring more conservative/careful output over raw speed.
- Keep Gemini 2.5 Flash as the **fallback model** for every agent (already wired as `_FALLBACK_MODEL`/`_DEFAULT_MODEL`) so a primary-provider outage degrades to "still answers, just on a different model" instead of a hard failure.
- Track provider/model in `ExecutionLog`/`AgentMetric` (already captured — `payload["model"]`) and review cost/quality per provider periodically to refine the assignment instead of guessing once and never revisiting it.
