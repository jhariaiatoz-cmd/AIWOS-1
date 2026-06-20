import asyncio
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_metric import AgentMetric
from app.models.execution_log import ExecutionLog
from app.models.knowledge_file import KnowledgeFile
from app.models.project import Project
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.services.conversation_service import _build_system_prompt, _detect_persona_conduct
from app.services.llm_provider_service import (
    LLMResponse,
    ProviderErrorType,
    classify_provider_error,
    complete as llm_complete,
    get_fallback_models,
    get_provider_for_model,
    is_retryable_error,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gemini-2.5-flash"
_KNOWLEDGE_CHAR_LIMIT = 15_000  # ~3,750 tokens at 4 chars/token
_HANDOFF_CHAR_LIMIT = 3_000

_PHASE_ORDER = ["Research", "Design", "Development", "Testing", "Deployment"]

# Exponential-backoff delays (seconds) before attempt 2, 3, and 4.
# Attempt 1 is always immediate.
_RETRY_DELAYS = [2, 5, 10]


class RetryExhaustedError(Exception):
    """Raised when all LLM retry attempts are exhausted for a transient error."""

    def __init__(self, original: Exception, retry_count: int) -> None:
        super().__init__(str(original))
        self.original = original
        self.retry_count = retry_count


def _extract_file_text(file_path: str, file_type: str) -> str:
    """Return plain text from a knowledge file on disk. Returns '' on any failure."""
    path = Path(file_path)
    if not path.exists():
        return ""
    try:
        if file_type in ("txt", "md", "csv"):
            return path.read_text(errors="replace")
        if file_type == "pdf":
            import pypdf  # already in requirements.txt
            reader = pypdf.PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        if file_type == "docx":
            import docx  # python-docx, already in requirements.txt
            doc = docx.Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        pass
    return ""


async def _load_knowledge_context(
    db: AsyncSession, organization_id: uuid.UUID
) -> str:
    """
    Fetch all non-deleted knowledge files for the org, extract their text, and
    return a single string capped at _KNOWLEDGE_CHAR_LIMIT characters.
    Files are processed oldest-first so foundational documents appear first.
    """
    result = await db.execute(
        select(KnowledgeFile)
        .where(
            KnowledgeFile.organization_id == organization_id,
            KnowledgeFile.deleted_at.is_(None),
        )
        .order_by(KnowledgeFile.created_at.asc())
    )
    files = list(result.scalars().all())
    if not files:
        return ""

    sections: list[str] = []
    total_chars = 0
    for kf in files:
        if total_chars >= _KNOWLEDGE_CHAR_LIMIT:
            break
        text = _extract_file_text(kf.file_path, kf.file_type).strip()
        if not text:
            continue
        budget = _KNOWLEDGE_CHAR_LIMIT - total_chars
        snippet = text[:budget]
        sections.append(f"### {kf.name}\n\n{snippet}")
        total_chars += len(snippet)

    return "\n\n---\n\n".join(sections)


async def _load_prior_phase_context(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_phase: str,
) -> str:
    """
    For each phase that precedes current_phase, fetch the latest completed
    execution output and return them formatted as a handoff context block.
    Total output is capped at _HANDOFF_CHAR_LIMIT characters.
    """
    if current_phase not in _PHASE_ORDER:
        return ""
    prior_phases = _PHASE_ORDER[: _PHASE_ORDER.index(current_phase)]
    if not prior_phases:
        return ""

    sections: list[str] = []
    total_chars = 0

    for phase in prior_phases:
        if total_chars >= _HANDOFF_CHAR_LIMIT:
            break

        task_result = await db.execute(
            select(Task.id).where(
                Task.project_id == project_id,
                Task.phase == phase,
                Task.deleted_at.is_(None),
            )
        )
        task_ids = [row[0] for row in task_result.all()]
        if not task_ids:
            continue

        exec_result = await db.execute(
            select(TaskExecution)
            .where(
                TaskExecution.task_id.in_(task_ids),
                TaskExecution.status == "completed",
                TaskExecution.deleted_at.is_(None),
            )
            .order_by(TaskExecution.completed_at.desc())
            .limit(1)
        )
        execution = exec_result.scalar_one_or_none()
        if execution is None:
            continue

        content = (execution.output_data or {}).get("content", "").strip()
        if not content:
            continue

        budget = _HANDOFF_CHAR_LIMIT - total_chars
        snippet = content[:budget]
        sections.append(f"### {phase}\n\n{snippet}")
        total_chars += len(snippet)

    if not sections:
        return ""

    return "## Previous Team Deliverables\n\n" + "\n\n".join(sections)


# Phase → deliverable-specific prompt guidance injected into every user prompt.
_PHASE_DELIVERABLE_GUIDANCE: dict[str, str] = {
    "Research": (
        "Your deliverable must cover: requirements analysis, market and competitive research findings, "
        "risk analysis, and stakeholder recommendations backed by evidence."
    ),
    "Design": (
        "Your deliverable must cover: user flows (entry → action → confirmation → error → recovery), "
        "UX recommendations with rationale, accessibility considerations (WCAG), and interface specifications."
    ),
    "Development": (
        "Your deliverable must cover: system architecture and service boundaries, API contracts (endpoints, "
        "schemas, SLAs), database design (models, indexes, migrations), and implementation approach with trade-offs."
    ),
    "Testing": (
        "Your deliverable must cover: test strategy, test plan (scope, entry/exit criteria, test types), "
        "test cases in Given-When-Then format, validation checklist, and defect scenarios. "
        "Do NOT include system architecture discussions, frontend or backend technology recommendations, "
        "or generic project planning sections."
    ),
    "Deployment": (
        "Your deliverable must cover: infrastructure plan (environments, networking, access controls), "
        "deployment architecture, CI/CD pipeline design (build, test gates, artifact management), "
        "monitoring and alerting strategy, and rollback strategy with runbook steps. "
        "Do NOT include system architecture discussions, frontend or backend technology recommendations, "
        "or generic project planning sections."
    ),
}

# Phase → required output sections that replace the generic document template.
_PHASE_OUTPUT_SECTIONS: dict[str, list[str]] = {
    "Testing": [
        "## Test Strategy",
        "## Test Plan",
        "## Test Cases",
        "## Validation Checklist",
        "## Defect Scenarios",
    ],
    "Deployment": [
        "## Infrastructure Plan",
        "## Deployment Architecture",
        "## CI/CD Pipeline",
        "## Monitoring",
        "## Rollback Strategy",
    ],
}

# ---------------------------------------------------------------------------
# Retry + fallback helpers
# ---------------------------------------------------------------------------

_FRIENDLY_ERROR_MESSAGES: dict[str, str] = {
    ProviderErrorType.QUOTA_EXCEEDED.value: (
        "The AI provider has exhausted its request quota."
    ),
    ProviderErrorType.RATE_LIMITED.value: (
        "The AI provider has reached its rate limit."
    ),
    ProviderErrorType.SERVICE_UNAVAILABLE.value: (
        "The AI provider is temporarily unavailable."
    ),
}


async def _call_llm_with_retry(
    db: AsyncSession,
    execution: TaskExecution,
    agent: Agent,
    task: Task,
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> tuple[LLMResponse, int]:
    """
    Call llm_complete with up to 4 attempts using exponential backoff.

    Returns (response, retry_count) where retry_count=0 means the first
    attempt succeeded.  Raises RetryExhaustedError when all attempts fail
    with a transient error.  Non-retryable errors are re-raised immediately.
    """
    last_exc: Exception = RuntimeError("unreachable")
    for attempt in range(4):
        if attempt > 0:
            await asyncio.sleep(_RETRY_DELAYS[attempt - 1])
        try:
            response = await llm_complete(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            return response, attempt  # 0 = first attempt, 1 = first retry, …
        except Exception as exc:
            if not is_retryable_error(exc):
                raise
            last_exc = exc
            if attempt < 3:  # more attempts remain — record the transient failure
                await _insert_execution_log(
                    db,
                    execution=execution,
                    agent=agent,
                    task=task,
                    status="retrying",
                    error_message="Provider temporarily unavailable. Retrying...",
                )
    raise RetryExhaustedError(last_exc, retry_count=3)


async def _call_with_provider_fallback(
    db: AsyncSession,
    execution: TaskExecution,
    agent: Agent,
    task: Task,
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> tuple[LLMResponse, int, str, Optional[str]]:
    """
    Try the primary model with retries, then automatically fall back to alternative
    providers when a quota / rate-limit / unavailability error is exhausted.

    Returns (llm_response, retry_count, provider_used, fallback_from_provider).
    fallback_from_provider is None when the primary provider succeeded.
    """
    primary_provider = get_provider_for_model(model)

    try:
        response, retry_count = await _call_llm_with_retry(
            db, execution, agent, task,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        return response, retry_count, primary_provider, None

    except RetryExhaustedError as exc:
        error_type = classify_provider_error(exc.original)
        is_quota_or_availability = error_type in (
            ProviderErrorType.QUOTA_EXCEEDED,
            ProviderErrorType.RATE_LIMITED,
            ProviderErrorType.SERVICE_UNAVAILABLE,
        )
        if not is_quota_or_availability:
            raise

        logger.warning(
            "Execution %s: provider=%s exhausted with %s (retries=%d). Attempting fallback.",
            execution.id, primary_provider, error_type.value, exc.retry_count,
        )

        fallbacks = get_fallback_models(model)
        last_exc = exc
        for fallback_provider, fallback_model in fallbacks:
            logger.info(
                "Execution %s: trying fallback provider=%s model=%s",
                execution.id, fallback_provider, fallback_model,
            )
            await _insert_execution_log(
                db, execution=execution, agent=agent, task=task,
                status="retrying",
                error_message=(
                    f"Primary provider ({primary_provider}) {error_type.value}. "
                    f"Switching to {fallback_provider}..."
                ),
            )
            try:
                response, retry_count = await _call_llm_with_retry(
                    db, execution, agent, task,
                    model=fallback_model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                logger.info(
                    "Execution %s: fallback to provider=%s succeeded (retries=%d)",
                    execution.id, fallback_provider, retry_count,
                )
                return response, retry_count, fallback_provider, primary_provider
            except RetryExhaustedError as fb_exc:
                logger.warning(
                    "Execution %s: fallback provider=%s also failed: %s",
                    execution.id, fallback_provider, fb_exc.original,
                )
                last_exc = fb_exc

        # All providers exhausted — propagate with the most recent failure
        raise RetryExhaustedError(last_exc.original, last_exc.retry_count)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_execution(
    db: AsyncSession,
    task_id: uuid.UUID,
    agent_id: Optional[uuid.UUID] = None,
) -> TaskExecution:
    """Create a pending TaskExecution row. Derives organization_id from the task."""
    task = await _get_task(db, task_id)
    execution = TaskExecution(
        id=uuid.uuid4(),
        task_id=task_id,
        organization_id=task.organization_id,
        agent_id=agent_id,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return execution


async def run_execution(db: AsyncSession, execution_id: uuid.UUID) -> TaskExecution:
    """
    Execute a pending TaskExecution end-to-end:
      load task + agent → build prompts → call LLM → persist results.
    """
    execution = await _get_execution(db, execution_id)
    if execution.status != "pending":
        raise ValueError(
            f"Cannot run execution with status '{execution.status}'. "
            "Only 'pending' executions can be started."
        )

    task = await _get_task(db, execution.task_id)
    project = await _get_project(db, task.project_id)
    agent = await _resolve_agent(db, execution, task)

    # Stamp running state
    execution.status = "running"
    execution.agent_id = agent.id
    execution.started_at = datetime.now(timezone.utc)
    await db.commit()

    system_prompt = _build_system_prompt(agent)
    knowledge_context = await _load_knowledge_context(db, task.organization_id)
    prior_phase_context = await _load_prior_phase_context(db, task.project_id, task.phase or "")
    user_prompt = _build_user_prompt(
        task, project,
        knowledge_context=knowledge_context,
        prior_phase_context=prior_phase_context,
    )
    execution.input_data = {"system_prompt": system_prompt, "user_prompt": user_prompt}

    persona_conduct = _detect_persona_conduct(agent)
    persona_label = persona_conduct[0][:60] if persona_conduct else "DEFAULT"
    logger.debug(
        "Execution | Task: %s | Assigned Agent: %s (%s) | Persona Used: %s",
        task.title,
        agent.name,
        agent.role,
        persona_label,
    )

    model = agent.model or _DEFAULT_MODEL
    started_at = execution.started_at

    # ── LLM call with retry + provider fallback ───────────────────────────────
    error_msg: Optional[str] = None
    error_retry_count: int = 0
    error_type_str: Optional[str] = None
    llm_response: Optional[LLMResponse] = None
    retry_count: int = 0
    provider_used: Optional[str] = None
    fallback_from_provider: Optional[str] = None

    try:
        llm_response, retry_count, provider_used, fallback_from_provider = (
            await _call_with_provider_fallback(
                db, execution, agent, task,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        )
    except RetryExhaustedError as exc:
        err_type = classify_provider_error(exc.original)
        error_type_str = err_type.value
        error_retry_count = exc.retry_count
        error_msg = _FRIENDLY_ERROR_MESSAGES.get(
            error_type_str, "Provider unavailable after multiple attempts."
        )
        provider_used = provider_used or get_provider_for_model(model)
        logger.error(
            "Execution %s: all providers exhausted. primary=%s error_type=%s retries=%d",
            execution.id, provider_used, error_type_str, error_retry_count,
        )
    except Exception as exc:
        error_msg = str(exc)
        error_type_str = "unknown"
        provider_used = provider_used or get_provider_for_model(model)

    if error_msg is not None:
        completed_at = datetime.now(timezone.utc)
        elapsed_ms = int((completed_at - started_at).total_seconds() * 1000)

        execution.status = "failed"
        execution.error_message = error_msg
        execution.retry_count = error_retry_count
        execution.completed_at = completed_at
        execution.execution_time_ms = elapsed_ms
        execution.output_data = {
            "provider_used": provider_used,
            "error_type": error_type_str or "unknown",
        }

        await db.commit()

        await _insert_execution_log(
            db,
            execution=execution,
            agent=agent,
            task=task,
            status="failed",
            error_message=error_msg,
            elapsed_ms=elapsed_ms,
        )
        await _upsert_agent_metric(
            db,
            organization_id=execution.organization_id,
            agent_id=agent.id,
            tasks_failed=1,
        )
        return execution
    # ─────────────────────────────────────────────────────────────────────────

    # Success path
    assert llm_response is not None
    completed_at = datetime.now(timezone.utc)
    elapsed_ms = int((completed_at - started_at).total_seconds() * 1000)

    execution.status = "completed"
    execution.output_data = {
        "content": llm_response.content,
        "provider_used": provider_used,
        "fallback_provider": fallback_from_provider,
    }
    execution.token_count = llm_response.input_tokens + llm_response.output_tokens
    execution.cost = llm_response.cost
    execution.completed_at = completed_at
    execution.execution_time_ms = elapsed_ms
    execution.retry_count = retry_count

    task.status = "Done"

    await db.commit()

    await _insert_execution_log(
        db,
        execution=execution,
        agent=agent,
        task=task,
        status="completed",
        llm_output=llm_response.content,
        input_tokens=llm_response.input_tokens,
        output_tokens=llm_response.output_tokens,
        cost=llm_response.cost,
        elapsed_ms=elapsed_ms,
    )
    await _upsert_agent_metric(
        db,
        organization_id=execution.organization_id,
        agent_id=agent.id,
        tasks_completed=1,
        total_tokens=execution.token_count,
        total_cost=float(llm_response.cost),
        active_time_seconds=elapsed_ms // 1000,
    )
    return execution


async def cancel_execution(db: AsyncSession, execution_id: uuid.UUID) -> TaskExecution:
    """Cancel a pending or running execution."""
    execution = await _get_execution(db, execution_id)
    if execution.status not in ("pending", "running"):
        raise ValueError(
            f"Cannot cancel execution with status '{execution.status}'. "
            "Only 'pending' or 'running' executions can be cancelled."
        )
    execution.status = "cancelled"
    execution.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(execution)
    return execution


async def get_execution(db: AsyncSession, execution_id: uuid.UUID) -> TaskExecution:
    """Public accessor — raises ValueError if not found."""
    return await _get_execution(db, execution_id)


async def list_executions(
    db: AsyncSession,
    *,
    task_id: Optional[uuid.UUID] = None,
    agent_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[TaskExecution]:
    from sqlalchemy import desc

    query = select(TaskExecution).where(TaskExecution.deleted_at.is_(None))
    if task_id is not None:
        query = query.where(TaskExecution.task_id == task_id)
    if agent_id is not None:
        query = query.where(TaskExecution.agent_id == agent_id)
    if status is not None:
        query = query.where(TaskExecution.status == status)
    query = query.order_by(desc(TaskExecution.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

async def _get_execution(db: AsyncSession, execution_id: uuid.UUID) -> TaskExecution:
    result = await db.execute(
        select(TaskExecution).where(
            TaskExecution.id == execution_id,
            TaskExecution.deleted_at.is_(None),
        )
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise ValueError(f"TaskExecution {execution_id} not found.")
    return execution


async def _get_project(db: AsyncSession, project_id: uuid.UUID) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise ValueError(f"Project {project_id} not found.")
    return project


async def _get_task(db: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise ValueError(f"Task {task_id} not found.")
    return task


async def _resolve_agent(
    db: AsyncSession,
    execution: TaskExecution,
    task: Task,
) -> Agent:
    # Prefer the specialist assigned to the task; only fall back to
    # execution.agent_id (set from the request body) when no specialist exists.
    # This prevents a project-owner agent passed via the API from silently
    # overriding the assigned specialist's persona and model.
    agent_id = task.assigned_to or execution.agent_id
    if agent_id is None:
        raise ValueError(
            f"No agent assigned to execution {execution.id} or task {task.id}."
        )
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise ValueError(f"Agent {agent_id} not found.")
    return agent


def _build_user_prompt(
    task: Task, project: Project, *, knowledge_context: str = "", prior_phase_context: str = ""
) -> str:
    lines: list[str] = [
        "You are executing a task and must produce a professional deliverable as your output.",
        "",
        f"**Project:** {project.name}",
    ]
    if project.description:
        lines.append(f"**Project Description:** {project.description}")
    lines += [
        "",
        f"**Task:** {task.title}",
    ]
    if task.description:
        lines.append(f"**Task Description:** {task.description}")

    # Inject phase-specific deliverable guidance so each specialist produces
    # the correct artifact type rather than a generic document.
    phase_guidance = _PHASE_DELIVERABLE_GUIDANCE.get(task.phase or "")
    if phase_guidance:
        lines += [
            "",
            f"**Deliverable Requirement ({task.phase} phase):** {phase_guidance}",
        ]

    # ── Knowledge Base ────────────────────────────────────────────────────────
    # Knowledge files uploaded for this organization are injected here so every
    # specialist can reference project requirements, specs, and other context
    # without any manual copy-paste.
    if knowledge_context:
        lines += [
            "",
            "## Knowledge Base",
            "",
            "The following documents have been uploaded for this project. "
            "Treat them as your primary reference when producing your deliverable.",
            "",
            knowledge_context,
        ]
    # ─────────────────────────────────────────────────────────────────────────

    # ── Prior Phase Handoff ───────────────────────────────────────────────────
    # Outputs from completed earlier phases are injected here so each specialist
    # can build directly on prior team deliverables.
    if prior_phase_context:
        lines += [
            "",
            prior_phase_context,
            "",
            "Use the above deliverables as your primary input. "
            "Do not repeat or summarise them — build on them.",
        ]
    # ─────────────────────────────────────────────────────────────────────────

    phase_sections = _PHASE_OUTPUT_SECTIONS.get(task.phase or "")
    if phase_sections:
        section_block = "\n\n".join(phase_sections)
        lines += [
            "",
            "Produce a complete, professional deliverable in Markdown using exactly these sections:",
            "",
            "# [Deliverable Title — choose a specific, professional title reflecting your role]",
            "",
            section_block,
            "",
            "Every section must contain substantive, expert-level content — not placeholder text. "
            "Do not add sections outside this list.",
        ]
    else:
        lines += [
            "",
            "Produce a complete, professional deliverable in Markdown. Structure your output using exactly these sections:",
            "",
            "# [Deliverable Title — choose a specific, professional title reflecting your role]",
            "",
            "## Executive Summary",
            "",
            "## Analysis",
            "",
            "## Recommendations",
            "",
            "## Implementation Plan",
            "",
            "## Risks",
            "",
            "## Next Actions",
            "",
            "Adapt section headings and content to your professional role and the nature of this task. "
            "Every section must contain substantive, expert-level content — not placeholder text.",
        ]
    return "\n".join(lines)


async def _insert_execution_log(
    db: AsyncSession,
    *,
    execution: TaskExecution,
    agent: Agent,
    task: Task,
    status: str,
    error_message: Optional[str] = None,
    llm_output: Optional[str] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost: float = 0.0,
    elapsed_ms: Optional[int] = None,
) -> None:
    log = ExecutionLog(
        id=uuid.uuid4(),
        organization_id=execution.organization_id,
        agent_id=agent.id,
        task_id=task.id,
        step_name="llm_call",
        action_type="chat_completion",
        input_data=execution.input_data,
        output_data={"content": llm_output} if llm_output else None,
        status=status,
        error_message=error_message,
        token_count=input_tokens + output_tokens,
        cost=cost,
        execution_time_ms=elapsed_ms,
    )
    db.add(log)
    await db.commit()


async def _upsert_agent_metric(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    agent_id: uuid.UUID,
    tasks_completed: int = 0,
    tasks_failed: int = 0,
    total_tokens: int = 0,
    total_cost: float = 0.0,
    active_time_seconds: int = 0,
) -> None:
    today = date.today()
    result = await db.execute(
        select(AgentMetric).where(
            AgentMetric.agent_id == agent_id,
            AgentMetric.date == today,
        )
    )
    metric = result.scalar_one_or_none()

    if metric is None:
        metric = AgentMetric(
            id=uuid.uuid4(),
            organization_id=organization_id,
            agent_id=agent_id,
            date=today,
            tasks_completed=tasks_completed,
            tasks_failed=tasks_failed,
            total_tokens=total_tokens,
            total_cost=total_cost,
            active_time_seconds=active_time_seconds,
        )
        db.add(metric)
    else:
        metric.tasks_completed += tasks_completed
        metric.tasks_failed += tasks_failed
        metric.total_tokens += total_tokens
        metric.total_cost = float(metric.total_cost) + total_cost
        metric.active_time_seconds += active_time_seconds

    await db.commit()
