# AIWOS LLM Provider Architecture — Current State

Companion diagram to `audit_report.md`. Reflects the system **as it exists today**, not a proposed design.

---

## 1. End-to-end call path (both entry points)

```
┌─────────────────────────────┐
│ Frontend: CommandHero.tsx    │  Dashboard prompt box
│ (app/(dashboard)/dashboard)  │
└──────────────┬────────────────┘
               │ POST /conversations { organization_id, user_id, prompt }
               ▼
┌─────────────────────────────────────────┐
│ app/api/v1/endpoints/conversations.py     │
│   create_conversation()                   │  injects user_id, no error handling
└──────────────┬────────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ app/services/conversation_service.py      │
│   create_conversation()                   │
│     ├─ agent_router.route(agents, prompt) │──┐
│     └─ _append_message_pair()             │  │
│           └─ _call_llm(agent, prompt)     │  │  Keyword/phrase scoring,
└──────────────┬────────────────────────────┘  │  7 priority tiers
               │ model = agent.model            │  (HR > Research > Sales >
               │        or "gemini-2.5-flash"   │   Finance > Marketing >
               ▼                                │   Support > Engineering)
┌─────────────────────────────────────────┐    │  Selects WHICH AGENT row
│ app/services/llm_provider_service.py      │◄───┘  answers — does NOT
│   complete(model, system_prompt, prompt)  │       select a provider.
│                                            │
│   if model startswith "gpt-"    → OpenAI  │
│   if model startswith "claude-" → Anthropic│
│   if model startswith "gemini-" → Gemini  │
└──────────────┬─────────────┬──────────────┘
               │             │             │
    ┌──────────▼───┐  ┌──────▼──────┐ ┌────▼────────┐
    │ AsyncOpenAI  │  │ AsyncAnthropic│ │ google_genai│
    │ chat.completions │ messages.create│ generate_content│
    └──────────────┘  └─────────────┘ └─────────────┘
        gpt-*             claude-*        gemini-*
        (configured,      (configured,    (configured,
         currently UNUSED  currently UNUSED ACTIVE — every
         by any seeded     by any seeded   seeded agent
         agent)            agent)          uses this)
```

```
┌─────────────────────────────────────────┐
│ Task / Workflow Runner                    │  Second entry point
│   app/services/execution_service.py       │
│   run_execution(execution_id)             │
│     ├─ _resolve_agent()                   │
│     ├─ model = agent.model or fallback    │
│     └─ llm_provider_service.complete(...) │──→ same three-way dispatch above
│           success → status="completed"    │
│           failure → status="failed",      │
│                     error_message=str(exc)│
└─────────────────────────────────────────┘
```

---

## 2. Configuration layer

```
aiwos-backend/.env
  OPENAI_API_KEY=...........  ✅ correct casing, loads
  ANTHROPIC_API_KEY=........  ✅ correct casing, loads
  Gemini_API_KEY=...........  ⚠️  wrong casing, loads ONLY because
                                  pydantic-settings defaults to
                                  case_sensitive=False (implicit,
                                  not declared in config.py)
         │
         ▼
app/core/config.py — Settings(BaseSettings)
  OPENAI_API_KEY: Optional[str]
  ANTHROPIC_API_KEY: Optional[str]
  GEMINI_API_KEY: Optional[str]
         │
         ▼
   settings  (singleton, imported by llm_provider_service.py)
```

`.env.example` contains **none** of the three keys — onboarding gap.

---

## 3. Agent → Model mapping (current seed data)

```
provisioning_service.py  _AGENTS[]
┌────────────────────────┬───────────┬──────────────────┐
│ Agent                  │ provider* │ model             │
├────────────────────────┼───────────┼──────────────────┤
│ Full Stack Engineer    │ "gemini"  │ gemini-2.5-flash  │
│ Backend Engineer       │ "gemini"  │ gemini-2.5-flash  │
│ UI/UX Designer         │ "gemini"  │ gemini-2.5-flash  │
│ HR Manager             │ "gemini"  │ gemini-2.5-flash  │
│ Sales Manager          │ "gemini"  │ gemini-2.5-flash  │
│ Marketing Strategist   │ "gemini"  │ gemini-2.5-flash  │
│ Research Analyst       │ "gemini"  │ gemini-2.5-flash  │
│ Support Specialist     │ "gemini"  │ gemini-2.5-flash  │
│ Finance Manager        │ "gemini"  │ gemini-2.5-flash  │
└────────────────────────┴───────────┴──────────────────┘
 * stored on Agent.provider column — NEVER READ by complete().
   Routing is 100% determined by the `model` string prefix.
   Changing `provider` alone has zero runtime effect.
```

**Result: 100% of agent traffic resolves to Gemini today.** OpenAI and Anthropic paths are fully functional and key-verified, but structurally unreachable until an agent's `model` field is manually changed to a `gpt-*` or `claude-*` string.

---

## 4. Failure-path behavior (both entry points)

```
complete() raises  ──┐
  (missing key:       │
   ValueError,         ├──► caught by bare `except Exception` at call site
   pre-network)        │
  (SDK error:           │      ┌─ Path A (conversation_service._call_llm):
   timeout, quota,      │      │    returns ("I encountered an error: {exc}", None)
   auth, rate-limit —   │      │    HTTP response is still 201 Created.
   propagated           ├──────┤    Failure only visible inside chat message text.
   unmodified           │      │
   from SDK)             │      └─ Path B (execution_service.run_execution):
                         │           execution.status = "failed"
                         │           execution.error_message = str(exc)
                         │           ExecutionLog row written, status="failed"
                         │
                         └──► NO retry. NO fallback to a different provider/model.
                              NO distinction between error types (auth vs.
                              timeout vs. quota) anywhere in the stack.
```

---

## 5. Summary of what's real vs. assumed

| Component | Status |
|---|---|
| OpenAI client wiring | ✅ Functional, key valid, currently unused by any agent |
| Anthropic client wiring | ✅ Functional, key valid, currently unused by any agent |
| Gemini client wiring | ✅ Functional, key valid (despite casing quirk), used by 100% of agents |
| Per-agent provider differentiation | ❌ Does not exist — `Agent.provider` is dead data |
| Fallback / retry on failure | ❌ Does not exist |
| Error-type differentiation | ❌ Does not exist — all failures are generic strings |
| Startup key validation | ❌ Does not exist — failures only surface on first call |
