"""
AgentExecutionEngine — centralized agent task execution service.

Accepts explicit (agent_id, task_id, execution_id) and owns the full
execution lifecycle:

  1. Load agent, task, project
  2. Load knowledge context  (knowledge_retrieval_service)
  3. Load dependency context (prior completed phases)
  4. Build system + user prompts
  5. Call LLM via llm_provider_service with retry + provider fallback
  6. Persist status, output, provider, model, duration to TaskExecution
  7. Write ExecutionLog and update AgentMetric
"""

import asyncio
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_metric import AgentMetric
from app.models.execution_log import ExecutionLog
from app.models.project import Project
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.services.conversation_service import _build_system_prompt, _detect_persona_conduct
from app.services.knowledge_retrieval_service import get_document_context
from app.services.memory_service import build_memory_content, load_recent_memories, save_memory
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
_HANDOFF_CHAR_LIMIT = 3_000
_PHASE_ORDER = ["Research", "Design", "Development", "Testing", "Deployment"]
_RETRY_DELAYS = [2, 5, 10]

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


class RetryExhaustedError(Exception):
    """Raised when all LLM retry attempts are exhausted for a transient error."""

    def __init__(self, original: Exception, retry_count: int) -> None:
        super().__init__(str(original))
        self.original = original
        self.retry_count = retry_count


class AgentExecutionEngine:
    """
    Centralized orchestrator for agent task execution.

    Usage::

        engine = AgentExecutionEngine(db)
        execution = await engine.run(agent_id, task_id, execution_id)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -------------------------------------------------------------------------
    # Public entry point
    # -------------------------------------------------------------------------

    async def run(
        self,
        agent_id: uuid.UUID,
        task_id: uuid.UUID,
        execution_id: uuid.UUID,
    ) -> TaskExecution:
        """
        Execute the task end-to-end and return the updated TaskExecution.

        The caller is responsible for ensuring the execution record is in
        'pending' status before calling this method.
        """
        # 1. Load entities
        execution = await self._load_execution(execution_id)
        task = await self._load_task(task_id)
        agent = await self._load_agent(agent_id)
        project = await self._load_project(task.project_id)

        # 2. Stamp running state
        execution.status = "running"
        execution.agent_id = agent.id
        execution.started_at = datetime.now(timezone.utc)
        await self.db.commit()

        # 3. Load knowledge context
        knowledge_context, knowledge_meta = await get_document_context(
            self.db,
            task.organization_id,
            task_title=task.title,
            task_description=task.description or "",
            agent_role=agent.role or "",
        )

        # 4. Load dependency context (prior completed phases)
        prior_phase_context, dep_refs = await self._load_prior_phase_context(
            task.project_id, task.phase or ""
        )

        # 4a. Load agent memory context
        memory_context = await load_recent_memories(
            self.db,
            agent_id=agent.id,
            project_id=task.project_id,
        )

        # 5. Build prompts
        system_prompt = _build_system_prompt(agent)
        user_prompt = self._build_user_prompt(
            task,
            project,
            knowledge_context=knowledge_context,
            prior_phase_context=prior_phase_context,
            memory_context=memory_context,
        )
        execution.input_data = {"system_prompt": system_prompt, "user_prompt": user_prompt}

        persona_conduct = _detect_persona_conduct(agent)
        persona_label = persona_conduct[0][:60] if persona_conduct else "DEFAULT"
        logger.debug(
            "Execution | Task: %s | Agent: %s (%s) | Persona: %s",
            task.title, agent.name, agent.role, persona_label,
        )

        model = agent.model or _DEFAULT_MODEL
        started_at = execution.started_at

        # 6. Execute via provider service with retry + fallback
        error_msg: Optional[str] = None
        error_retry_count: int = 0
        error_type_str: Optional[str] = None
        llm_response: Optional[LLMResponse] = None
        retry_count: int = 0
        provider_used: Optional[str] = None
        fallback_from_provider: Optional[str] = None

        try:
            llm_response, retry_count, provider_used, fallback_from_provider = (
                await self._call_with_provider_fallback(
                    execution, agent, task,
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

        # 7. Persist status, output, provider, model, duration
        completed_at = datetime.now(timezone.utc)
        elapsed_ms = int((completed_at - started_at).total_seconds() * 1000)

        if error_msg is not None:
            execution.status = "failed"
            execution.error_message = error_msg
            execution.retry_count = error_retry_count
            execution.completed_at = completed_at
            execution.execution_time_ms = elapsed_ms
            execution.output_data = {
                "provider_used": provider_used,
                "model": model,
                "error_type": error_type_str or "unknown",
                "dependency_ids": [d["execution_id"] for d in dep_refs],
                "dependency_count": len(dep_refs),
                "dependency_context_used": bool(dep_refs),
                "dependencies_used": dep_refs,
            }
            await self.db.commit()

            # 8. Update execution logs
            await self._insert_execution_log(
                execution=execution,
                agent=agent,
                task=task,
                status="failed",
                error_message=error_msg,
                elapsed_ms=elapsed_ms,
            )
            await self._upsert_agent_metric(
                organization_id=execution.organization_id,
                agent_id=agent.id,
                tasks_failed=1,
            )
            return execution

        # Success path
        assert llm_response is not None
        execution.status = "completed"
        execution.output_data = {
            "content": llm_response.content,
            "provider_used": provider_used,
            "model": model,
            "fallback_provider": fallback_from_provider,
            "knowledge_chunks_used": knowledge_meta or [],
            "dependency_ids": [d["execution_id"] for d in dep_refs],
            "dependency_count": len(dep_refs),
            "dependency_context_used": bool(dep_refs),
            "dependencies_used": dep_refs,
        }
        execution.token_count = llm_response.input_tokens + llm_response.output_tokens
        execution.cost = llm_response.cost
        execution.completed_at = completed_at
        execution.execution_time_ms = elapsed_ms
        execution.retry_count = retry_count

        task.status = "Done"
        await self.db.commit()

        # 8a. Persist memory of this completed task
        await save_memory(
            self.db,
            agent_id=agent.id,
            organization_id=execution.organization_id,
            project_id=task.project_id,
            content=build_memory_content(task.title, task.phase, llm_response.content),
        )

        # 8. Update execution logs
        await self._insert_execution_log(
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
        await self._upsert_agent_metric(
            organization_id=execution.organization_id,
            agent_id=agent.id,
            tasks_completed=1,
            total_tokens=execution.token_count,
            total_cost=float(llm_response.cost),
            active_time_seconds=elapsed_ms // 1000,
        )
        return execution

    # -------------------------------------------------------------------------
    # Entity loaders
    # -------------------------------------------------------------------------

    async def _load_execution(self, execution_id: uuid.UUID) -> TaskExecution:
        result = await self.db.execute(
            select(TaskExecution).where(
                TaskExecution.id == execution_id,
                TaskExecution.deleted_at.is_(None),
            )
        )
        execution = result.scalar_one_or_none()
        if execution is None:
            raise ValueError(f"TaskExecution {execution_id} not found.")
        return execution

    async def _load_task(self, task_id: uuid.UUID) -> Task:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise ValueError(f"Task {task_id} not found.")
        return task

    async def _load_agent(self, agent_id: uuid.UUID) -> Agent:
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
        )
        agent = result.scalar_one_or_none()
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found.")
        return agent

    async def _load_project(self, project_id: uuid.UUID) -> Project:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.deleted_at.is_(None),
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError(f"Project {project_id} not found.")
        return project

    # -------------------------------------------------------------------------
    # Dependency context (prior completed phase outputs)
    # -------------------------------------------------------------------------

    async def _load_prior_phase_context(
        self,
        project_id: uuid.UUID,
        current_phase: str,
    ) -> tuple[str, list[dict]]:
        """
        For each phase preceding current_phase, fetch the latest completed
        execution output and format it as a handoff context block.
        Total output is capped at _HANDOFF_CHAR_LIMIT characters.

        Returns (context_str, dep_refs).
        """
        if current_phase not in _PHASE_ORDER:
            return "", []
        prior_phases = _PHASE_ORDER[: _PHASE_ORDER.index(current_phase)]
        if not prior_phases:
            return "", []

        sections: list[str] = []
        dep_refs: list[dict] = []
        total_chars = 0

        for phase in prior_phases:
            if total_chars >= _HANDOFF_CHAR_LIMIT:
                break

            task_result = await self.db.execute(
                select(Task.id, Task.title).where(
                    Task.project_id == project_id,
                    Task.phase == phase,
                    Task.deleted_at.is_(None),
                )
            )
            task_rows = task_result.all()
            task_ids = [row[0] for row in task_rows]
            task_titles = {row[0]: row[1] for row in task_rows}
            if not task_ids:
                continue

            exec_result = await self.db.execute(
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

            dep_refs.append({
                "execution_id": str(execution.id),
                "task_title": task_titles.get(execution.task_id, f"{phase} Task"),
                "task_phase": phase,
            })

        if not sections:
            return "", []

        return "## Previous Team Deliverables\n\n" + "\n\n".join(sections), dep_refs

    # -------------------------------------------------------------------------
    # Prompt building
    # -------------------------------------------------------------------------

    def _build_user_prompt(
        self,
        task: Task,
        project: Project,
        *,
        knowledge_context: str = "",
        prior_phase_context: str = "",
        memory_context: str = "",
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

        phase_guidance = _PHASE_DELIVERABLE_GUIDANCE.get(task.phase or "")
        if phase_guidance:
            lines += [
                "",
                f"**Deliverable Requirement ({task.phase} phase):** {phase_guidance}",
            ]

        if memory_context:
            lines += [
                "",
                memory_context,
                "",
                "Use the above memory as background context on work you have previously done.",
            ]

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

        if prior_phase_context:
            lines += [
                "",
                prior_phase_context,
                "",
                "Use the above deliverables as your primary input. "
                "Do not repeat or summarise them — build on them.",
            ]

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

    # -------------------------------------------------------------------------
    # LLM execution: retry + provider fallback
    # -------------------------------------------------------------------------

    async def _call_llm_with_retry(
        self,
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

        Returns (response, retry_count). Raises RetryExhaustedError when all
        attempts fail with a transient error. Non-retryable errors are re-raised.
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
                return response, attempt
            except Exception as exc:
                if not is_retryable_error(exc):
                    raise
                last_exc = exc
                if attempt < 3:
                    await self._insert_execution_log(
                        execution=execution,
                        agent=agent,
                        task=task,
                        status="retrying",
                        error_message="Provider temporarily unavailable. Retrying...",
                    )
        raise RetryExhaustedError(last_exc, retry_count=3)

    async def _call_with_provider_fallback(
        self,
        execution: TaskExecution,
        agent: Agent,
        task: Task,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
    ) -> tuple[LLMResponse, int, str, Optional[str]]:
        """
        Try the primary model with retries, then fall back to alternative
        providers on quota / rate-limit / availability exhaustion.

        Returns (llm_response, retry_count, provider_used, fallback_from_provider).
        fallback_from_provider is None when the primary provider succeeded.
        """
        primary_provider = get_provider_for_model(model)

        try:
            response, retry_count = await self._call_llm_with_retry(
                execution, agent, task,
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
                await self._insert_execution_log(
                    execution=execution, agent=agent, task=task,
                    status="retrying",
                    error_message=(
                        f"Primary provider ({primary_provider}) {error_type.value}. "
                        f"Switching to {fallback_provider}..."
                    ),
                )
                try:
                    response, retry_count = await self._call_llm_with_retry(
                        execution, agent, task,
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

            raise RetryExhaustedError(last_exc.original, last_exc.retry_count)

    # -------------------------------------------------------------------------
    # Persistence helpers
    # -------------------------------------------------------------------------

    async def _insert_execution_log(
        self,
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
        self.db.add(log)
        await self.db.commit()

    async def _upsert_agent_metric(
        self,
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
        result = await self.db.execute(
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
            self.db.add(metric)
        else:
            metric.tasks_completed += tasks_completed
            metric.tasks_failed += tasks_failed
            metric.total_tokens += total_tokens
            metric.total_cost = float(metric.total_cost) + total_cost
            metric.active_time_seconds += active_time_seconds

        await self.db.commit()
