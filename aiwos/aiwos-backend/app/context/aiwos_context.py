"""
Static project context injected into every agent system prompt.

This is a compile-time constant — no DB queries, no file I/O, no runtime cost.
It gives every agent awareness of the AIWOS codebase so responses reference
existing systems rather than suggesting generic implementations.

Keep this concise (~600 tokens) to minimise per-turn overhead.
"""

AIWOS_PROJECT_CONTEXT: str = """\
## AIWOS Project Context

You are an agent inside **AIWOS** (AI Workforce Operating System) — a \
multi-tenant SaaS platform that lets organisations create, deploy, and \
manage AI agents across departments. When answering questions about building, \
extending, or debugging AIWOS, always reference the existing architecture \
below rather than suggesting generic implementations.

### Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, \
shadcn/ui, Zustand (global state), TanStack Query (server state), Lucide icons
- **Backend**: FastAPI (Python), async SQLAlchemy 2, Alembic migrations, \
PostgreSQL + pgvector, Pydantic v2 schemas
- **LLM providers**: Anthropic Claude, OpenAI GPT, Google Gemini — abstracted \
behind `app/services/llm_provider_service.py`
- **Deployment**: Monorepo — frontend at `aiwos/`, backend at `aiwos/aiwos-backend/`

### Authentication
AIWOS uses **custom JWT auth** — NOT Supabase SSR or any third-party auth service.
- Tokens: HS256 JWT, 1440-minute expiry, `sub` = user UUID
- Password hashing: bcrypt 12 rounds via `app/core/security.py`
- Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, \
`GET /api/v1/auth/me`
- Dependency: `get_current_user()` in `app/core/dependencies.py` — validates \
Bearer token and returns the `User` ORM row
- Frontend: JWT stored in `localStorage` as `"aiwos-token"`, attached to every \
request via Axios interceptor in `lib/api/client.ts`; 401 → redirect to `/auth`

### Database Tables (PostgreSQL)
- `users` — id, email (unique), hashed_password, full_name, avatar_url
- `organizations` — id, name, slug (unique)
- `organization_members` — org_id, user_id, role; composite unique
- `departments` — id, org_id, name, description, is_custom
- `agents` — id, org_id, dept_id, name, role, goal, instructions, \
skills (JSONB), status, is_manager, provider, model, memory_config, \
tools (JSONB), permissions (JSONB)
- `conversations` — id, org_id, user_id, agent_id, title, context_type
- `messages` — id, conversation_id, org_id, sender_type ("user"/"agent"), \
sender_id, content, payload (JSONB with tokens/cost), execution_id
- `tasks` — id, org_id, project_id, assigned_to (agent_id), title, \
description, priority, status, due_date
- `task_executions` — id, task_id, agent_id, status, input_data, output_data, \
token_count, cost, execution_time_ms
- `projects` — id, org_id, name, description, status, created_by
- `knowledge_files` — id, org_id, dept_id, name, file_path, file_type
- `knowledge_chunks` — id, knowledge_file_id, content, embedding (pgvector 1536-dim)
- `workflows`, `workflow_steps`, `workflow_agents` — orchestration primitives
- `execution_logs` — audit trail for every LLM call
- `agent_metrics` — daily aggregates per agent (tokens, cost, task counts)

### Backend API Routes (`/api/v1/`)
- `/auth` — register, login, me
- `/agents` — CRUD + list (filter by org)
- `/conversations` — create, list, get; `/conversations/{id}/messages` — send + poll
- `/tasks`, `/projects`, `/workflows` — full CRUD
- `/executions` — create, run, cancel, list
- `/organizations`, `/departments` — org-structure management
- All routes require `Authorization: Bearer <token>` except auth endpoints

### Frontend Pages (`app/(dashboard)/`)
- `/dashboard` — metrics overview
- `/chat` — multi-turn conversations with agents
- `/agents` — create / edit agents (name, role, goal, instructions, skills, model)
- `/tasks` — task list and detail; trigger task executions
- `/projects` — project management
- `/workflows` — workflow builder
- `/knowledge` — file upload and knowledge base management
- `/analytics`, `/settings`, `/integrations` — supporting pages
"""
