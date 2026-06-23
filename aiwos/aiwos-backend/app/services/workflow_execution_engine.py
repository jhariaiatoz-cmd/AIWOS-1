"""
WorkflowExecutionEngine — sequential workflow step executor with agent handoffs.

Loads a Workflow's steps (ordered by step_order), executes each step with
AgentExecutionEngine, passes the previous step's output as context to the
next, and stops immediately on any step failure.

Each WorkflowStep must have config["task_id"] pointing to an existing Task.
Steps without a task_id are skipped with a warning.

State is persisted in WorkflowExecution throughout execution:
  - current_step_order  : step_order of the active step
  - completed_steps     : list of completed step summaries
  - failed_steps        : list of failed step summaries
  - step_outputs        : dict of node_id -> output content
  - status              : pending | running | completed | failed

Agent handoffs are recorded in AgentHandoff rows whenever output is passed
from one step's agent to the next step's agent.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.models.agent_handoff import AgentHandoff
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.models.workflow import Workflow
from app.models.workflow_execution import WorkflowExecution
from app.models.workflow_step import WorkflowStep
from app.services.agent_execution_engine import AgentExecutionEngine

logger = logging.getLogger(__name__)

_PRIOR_STEP_CHAR_LIMIT = 3_000


class _WorkflowStepEngine(AgentExecutionEngine):
    """
    AgentExecutionEngine subclass that injects the previous workflow step's
    output as additional context in the user prompt.
    """

    def __init__(
        self,
        db: AsyncSession,
        prior_step_output: Optional[str] = None,
    ) -> None:
        super().__init__(db)
        self._prior_step_output = prior_step_output

    def _build_user_prompt(
        self,
        task: Task,
        project,
        *,
        knowledge_context: str = "",
        prior_phase_context: str = "",
        memory_context: str = "",
        comm_context: str = "",
    ) -> str:
        base = super()._build_user_prompt(
            task,
            project,
            knowledge_context=knowledge_context,
            prior_phase_context=prior_phase_context,
            memory_context=memory_context,
            comm_context=comm_context,
        )
        if not self._prior_step_output:
            return base
        snippet = self._prior_step_output[:_PRIOR_STEP_CHAR_LIMIT]
        return (
            base
            + "\n\n## Previous Workflow Step Output\n\n"
            + snippet
            + "\n\nBuild on the above output from the preceding workflow step."
        )


class WorkflowExecutionEngine:
    """
    Sequential workflow executor with agent-to-agent handoff tracking.

    Usage::

        engine = WorkflowExecutionEngine(db)
        wf_exec = await engine.run(workflow_id, organization_id)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -------------------------------------------------------------------------
    # Public entry point
    # -------------------------------------------------------------------------

    async def run(
        self,
        workflow_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        wf_exec_id: Optional[uuid.UUID] = None,
    ) -> WorkflowExecution:
        """
        Execute all steps of the workflow sequentially and return the
        WorkflowExecution record with full state.

        If wf_exec_id is provided the engine reuses that existing
        WorkflowExecution row (created by the endpoint before dispatching
        the background task); otherwise a new row is created.
        """
        workflow = await self._load_workflow(workflow_id)
        steps = sorted(workflow.steps, key=lambda s: s.step_order)

        if wf_exec_id is not None:
            wf_exec = await self._load_workflow_execution(wf_exec_id)
        else:
            wf_exec = await self._create_workflow_execution(workflow, organization_id)

        logger.info(
            "Workflow %s | execution_id=%s | %d step(s) | starting",
            workflow_id, wf_exec.id, len(steps),
        )

        if not steps:
            logger.info("Workflow %s | execution_id=%s | no steps → completed", workflow_id, wf_exec.id)
            return await self._finish(wf_exec, status="completed")

        prior_output: Optional[str] = None
        prev_step: Optional[WorkflowStep] = None
        prev_result: Optional[TaskExecution] = None

        for step in steps:
            task_id = self._extract_task_id(step)
            if task_id is None:
                logger.warning(
                    "Workflow %s | execution_id=%s | step '%s' (order=%d) has no task_id; skipping.",
                    workflow_id, wf_exec.id, step.node_id, step.step_order,
                )
                continue

            wf_exec.current_step_order = step.step_order
            await self.db.commit()

            logger.info(
                "Workflow %s | execution_id=%s | step '%s' order=%d task_id=%s | starting",
                workflow_id, wf_exec.id, step.node_id, step.step_order, task_id,
            )

            result, error = await self._execute_step(step, task_id, prior_output)

            if error or result is None or result.status == "failed":
                err_msg = error or (result.error_message if result else "Unknown error")
                logger.error(
                    "Workflow %s | execution_id=%s | step '%s' order=%d task_id=%s | failed: %s",
                    workflow_id, wf_exec.id, step.node_id, step.step_order, task_id, err_msg,
                )
                # Record handoff even for failed target steps so history is complete
                if prev_result is not None and prior_output is not None:
                    await self._record_handoff(
                        wf_exec, prev_step, prev_result, step, result, prior_output
                    )
                await self._record_step_failure(wf_exec, step, result, err_msg)
                wf_exec.error_message = (
                    f"Step '{step.name}' (order={step.step_order}) failed: {err_msg}"
                )
                return await self._finish(wf_exec, status="failed")

            # Step succeeded — capture output
            output_content = (result.output_data or {}).get("content", "")
            logger.info(
                "Workflow %s | execution_id=%s | step '%s' order=%d task_id=%s agent_id=%s | completed",
                workflow_id, wf_exec.id, step.node_id, step.step_order, task_id,
                result.agent_id,
            )
            await self._record_step_completion(wf_exec, step, result, output_content)

            # Record the handoff: previous agent → this agent
            if prev_result is not None and prior_output is not None:
                await self._record_handoff(
                    wf_exec, prev_step, prev_result, step, result, prior_output
                )

            prev_step = step
            prev_result = result
            prior_output = output_content or None

        logger.info(
            "Workflow %s | execution_id=%s | all steps completed → completed",
            workflow_id, wf_exec.id,
        )
        return await self._finish(wf_exec, status="completed")

    # -------------------------------------------------------------------------
    # Step execution
    # -------------------------------------------------------------------------

    async def _execute_step(
        self,
        step: WorkflowStep,
        task_id: uuid.UUID,
        prior_output: Optional[str],
    ) -> tuple[Optional[TaskExecution], Optional[str]]:
        """
        Create a TaskExecution and run it via _WorkflowStepEngine.
        Returns (result, error_message). error_message is None on success.
        """
        try:
            task = await self._load_task(task_id)
        except ValueError as exc:
            logger.error("Step '%s': task load failed — %s", step.node_id, exc)
            return None, str(exc)

        try:
            agent_id = await self._resolve_agent_id(step, task)
        except ValueError as exc:
            logger.error(
                "Step '%s' task_id=%s: agent resolution failed — %s",
                step.node_id, task_id, exc,
            )
            return None, str(exc)

        execution = TaskExecution(
            id=uuid.uuid4(),
            task_id=task_id,
            organization_id=task.organization_id,
            agent_id=agent_id,
            status="pending",
        )
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(
            "Step '%s' task_id=%s agent_id=%s execution_id=%s | starting",
            step.node_id, task_id, agent_id, execution.id,
        )

        try:
            engine = _WorkflowStepEngine(self.db, prior_step_output=prior_output)
            result = await engine.run(agent_id, task_id, execution.id)
            return result, None
        except Exception as exc:
            logger.exception(
                "WorkflowExecutionEngine: unhandled error on step '%s' execution_id=%s: %s",
                step.node_id, execution.id, exc,
            )
            return None, str(exc)

    # -------------------------------------------------------------------------
    # Handoff recording
    # -------------------------------------------------------------------------

    async def _record_handoff(
        self,
        wf_exec: WorkflowExecution,
        source_step: WorkflowStep,
        source_result: TaskExecution,
        target_step: WorkflowStep,
        target_result: Optional[TaskExecution],
        handoff_content: str,
    ) -> None:
        """
        Persist an AgentHandoff row linking source → target agent.
        status is "completed" when the target ran (success or fail),
        meaning the content was injected into the target's prompt.
        """
        status = "completed" if target_result is not None else "injected"
        handoff = AgentHandoff(
            id=uuid.uuid4(),
            workflow_execution_id=wf_exec.id,
            source_agent_id=source_result.agent_id,
            target_agent_id=target_result.agent_id if target_result else None,
            source_execution_id=source_result.id,
            target_execution_id=target_result.id if target_result else None,
            handoff_content=handoff_content[:_PRIOR_STEP_CHAR_LIMIT],
            status=status,
            source_step_order=source_step.step_order,
            target_step_order=target_step.step_order,
        )
        self.db.add(handoff)
        await self.db.commit()
        logger.info(
            "Recorded handoff: step %d (agent=%s) → step %d (agent=%s) [%s]",
            source_step.step_order,
            source_result.agent_id,
            target_step.step_order,
            handoff.target_agent_id,
            status,
        )

    # -------------------------------------------------------------------------
    # State helpers
    # -------------------------------------------------------------------------

    async def _create_workflow_execution(
        self,
        workflow: Workflow,
        organization_id: uuid.UUID,
    ) -> WorkflowExecution:
        wf_exec = WorkflowExecution(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            organization_id=organization_id,
            status="running",
            current_step_order=None,
            completed_steps=[],
            failed_steps=[],
            step_outputs={},
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(wf_exec)
        await self.db.commit()
        await self.db.refresh(wf_exec)
        return wf_exec

    async def _record_step_completion(
        self,
        wf_exec: WorkflowExecution,
        step: WorkflowStep,
        result: TaskExecution,
        output_content: str,
    ) -> None:
        completed = list(wf_exec.completed_steps or [])
        completed.append({
            "node_id": step.node_id,
            "step_order": step.step_order,
            "name": step.name,
            "execution_id": str(result.id),
        })
        outputs = dict(wf_exec.step_outputs or {})
        outputs[step.node_id] = output_content[:_PRIOR_STEP_CHAR_LIMIT]

        wf_exec.completed_steps = completed
        wf_exec.step_outputs = outputs
        await self.db.commit()

    async def _record_step_failure(
        self,
        wf_exec: WorkflowExecution,
        step: WorkflowStep,
        result: Optional[TaskExecution],
        error_msg: str,
    ) -> None:
        failed = list(wf_exec.failed_steps or [])
        failed.append({
            "node_id": step.node_id,
            "step_order": step.step_order,
            "name": step.name,
            "execution_id": str(result.id) if result else None,
            "error": error_msg,
        })
        wf_exec.failed_steps = failed
        await self.db.commit()

    async def _finish(
        self, wf_exec: WorkflowExecution, *, status: str
    ) -> WorkflowExecution:
        wf_exec.status = status
        wf_exec.current_step_order = None
        wf_exec.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(wf_exec)
        return wf_exec

    # -------------------------------------------------------------------------
    # Entity loaders / resolvers
    # -------------------------------------------------------------------------

    async def _load_workflow_execution(self, wf_exec_id: uuid.UUID) -> WorkflowExecution:
        result = await self.db.execute(
            select(WorkflowExecution).where(
                WorkflowExecution.id == wf_exec_id,
                WorkflowExecution.deleted_at.is_(None),
            )
        )
        wf_exec = result.scalar_one_or_none()
        if wf_exec is None:
            raise ValueError(f"WorkflowExecution {wf_exec_id} not found.")
        return wf_exec

    async def _load_workflow(self, workflow_id: uuid.UUID) -> Workflow:
        result = await self.db.execute(
            select(Workflow)
            .where(Workflow.id == workflow_id, Workflow.deleted_at.is_(None))
            .options(selectinload(Workflow.steps))
        )
        workflow = result.scalar_one_or_none()
        if workflow is None:
            raise ValueError(f"Workflow {workflow_id} not found.")
        return workflow

    async def _load_task(self, task_id: uuid.UUID) -> Task:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise ValueError(f"Task {task_id} not found.")
        return task

    async def _resolve_agent_id(
        self, step: WorkflowStep, task: Task
    ) -> uuid.UUID:
        """Step-level agent_id takes priority over the task's assigned agent."""
        agent_id = step.agent_id or task.assigned_to
        if agent_id is None:
            raise ValueError(
                f"Step '{step.node_id}' has no agent_id and task {task.id} "
                "has no assigned agent."
            )
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"Agent {agent_id} not found.")
        return agent_id

    @staticmethod
    def _extract_task_id(step: WorkflowStep) -> Optional[uuid.UUID]:
        """Read task_id from step.config["task_id"], returns None if absent or invalid."""
        if not step.config:
            return None
        raw = step.config.get("task_id")
        if raw is None:
            return None
        try:
            return uuid.UUID(str(raw))
        except (ValueError, AttributeError):
            logger.warning(
                "Step '%s' has invalid task_id in config: %r", step.node_id, raw
            )
            return None
