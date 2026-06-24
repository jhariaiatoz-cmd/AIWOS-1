"""
WorkflowExecutionEngine — parallel-aware workflow step executor with agent handoffs.

Steps sharing the same step_order are executed concurrently via asyncio.gather().
Steps with unique step_orders run sequentially (preserving existing behaviour exactly).

Parallelism is bounded by MAX_PARALLEL_AGENTS (semaphore).  Each parallel step
gets its own isolated AsyncSession so the shared session is never used concurrently.

Fallback: if asyncio.gather() itself raises an unexpected error the group is
re-run sequentially via the original _execute_step path.

State is persisted in WorkflowExecution throughout execution:
  - current_step_order  : step_order of the active group
  - completed_steps     : list of completed step summaries
  - failed_steps        : list of failed step summaries
  - step_outputs        : dict of node_id -> output content
  - status              : pending | running | completed | failed

Agent handoffs are recorded in AgentHandoff rows for sequential step transitions.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from itertools import groupby
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
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

# Maximum agents that may execute concurrently across all parallel groups.
MAX_PARALLEL_AGENTS = 5


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
    Parallel-aware workflow executor with sequential fallback.

    Steps sharing the same step_order run concurrently; steps with different
    orders run sequentially in ascending order.

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
        Execute all workflow steps and return the WorkflowExecution record.

        Steps with the same step_order are run in parallel.
        Steps with unique step_orders are run sequentially (existing behaviour).

        If wf_exec_id is provided the engine reuses that existing
        WorkflowExecution row; otherwise a new row is created.
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
            logger.info(
                "Workflow %s | execution_id=%s | no steps → completed",
                workflow_id, wf_exec.id,
            )
            return await self._finish(wf_exec, status="completed")

        # Group steps by step_order; steps sharing an order run in parallel.
        step_groups: list[tuple[int, list[WorkflowStep]]] = [
            (order, list(grp))
            for order, grp in groupby(steps, key=lambda s: s.step_order)
        ]

        semaphore = asyncio.Semaphore(MAX_PARALLEL_AGENTS)
        prior_output: Optional[str] = None

        # Handoff tracking is only maintained for sequential (single-step) groups.
        prev_step: Optional[WorkflowStep] = None
        prev_result: Optional[TaskExecution] = None

        for order, group_steps in step_groups:
            wf_exec.current_step_order = order
            await self.db.commit()

            if len(group_steps) == 1:
                # ---- Sequential path — original behaviour preserved exactly ----
                step = group_steps[0]
                task_id = self._extract_task_id(step)
                if task_id is None:
                    logger.warning(
                        "Workflow %s | execution_id=%s | step '%s' (order=%d) has no task_id; skipping.",
                        workflow_id, wf_exec.id, step.node_id, step.step_order,
                    )
                    continue

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
                    if prev_result is not None and prior_output is not None:
                        await self._record_handoff(
                            wf_exec, prev_step, prev_result, step, result, prior_output
                        )
                    await self._record_step_failure(wf_exec, step, result, err_msg)
                    wf_exec.error_message = (
                        f"Step '{step.name}' (order={step.step_order}) failed: {err_msg}"
                    )
                    return await self._finish(wf_exec, status="failed")

                output_content = (result.output_data or {}).get("content", "")
                logger.info(
                    "Workflow %s | execution_id=%s | step '%s' order=%d task_id=%s agent_id=%s | completed",
                    workflow_id, wf_exec.id, step.node_id, step.step_order, task_id,
                    result.agent_id,
                )
                await self._record_step_completion(wf_exec, step, result, output_content)

                if prev_result is not None and prior_output is not None:
                    await self._record_handoff(
                        wf_exec, prev_step, prev_result, step, result, prior_output
                    )

                prev_step = step
                prev_result = result
                prior_output = output_content or None

            else:
                # ---- Parallel path — steps share the same step_order ----
                logger.info(
                    "Workflow %s | execution_id=%s | order=%d | %d steps → parallel execution",
                    workflow_id, wf_exec.id, order, len(group_steps),
                )

                try:
                    outcomes = await self._execute_parallel_group(
                        group_steps, prior_output, semaphore
                    )
                except Exception as exc:
                    # Unexpected gather failure — revert to sequential for this group.
                    logger.warning(
                        "Workflow %s | execution_id=%s | parallel gather failed (%s); "
                        "falling back to sequential for order=%d",
                        workflow_id, wf_exec.id, exc, order,
                    )
                    outcomes = await self._execute_sequential_fallback(
                        group_steps, prior_output
                    )

                # Process all outcomes; siblings continue even when one fails.
                any_failure = False
                combined_parts: list[str] = []

                for step, result, error in outcomes:
                    if error or result is None or result.status == "failed":
                        err_msg = error or (result.error_message if result else "Unknown error")
                        logger.error(
                            "Workflow %s | execution_id=%s | step '%s' order=%d | failed: %s",
                            workflow_id, wf_exec.id, step.node_id, step.step_order, err_msg,
                        )
                        await self._record_step_failure(wf_exec, step, result, err_msg)
                        any_failure = True
                    else:
                        output_content = (result.output_data or {}).get("content", "")
                        logger.info(
                            "Workflow %s | execution_id=%s | step '%s' order=%d agent_id=%s | completed",
                            workflow_id, wf_exec.id, step.node_id, step.step_order, result.agent_id,
                        )
                        await self._record_step_completion(wf_exec, step, result, output_content)
                        if output_content:
                            combined_parts.append(
                                f"### {step.name or step.node_id}\n\n{output_content}"
                            )

                if any_failure:
                    wf_exec.error_message = (
                        f"One or more parallel steps at order={order} failed."
                    )
                    return await self._finish(wf_exec, status="failed")

                # Combined output of the group becomes prior_output for the next group.
                prior_output = "\n\n".join(combined_parts) or None
                # Handoff tracking is not applicable across parallel group boundaries.
                prev_step = None
                prev_result = None

        logger.info(
            "Workflow %s | execution_id=%s | all steps completed → completed",
            workflow_id, wf_exec.id,
        )
        return await self._finish(wf_exec, status="completed")

    # -------------------------------------------------------------------------
    # Parallel execution helpers
    # -------------------------------------------------------------------------

    async def _execute_parallel_group(
        self,
        steps: list[WorkflowStep],
        prior_output: Optional[str],
        semaphore: asyncio.Semaphore,
    ) -> list[tuple[WorkflowStep, Optional[TaskExecution], Optional[str]]]:
        """
        Run all runnable steps concurrently.  Steps without a task_id are
        skipped (warning logged).  Each step runs in its own isolated session.
        return_exceptions=True ensures one failure doesn't abort siblings.
        """
        runnable: list[tuple[WorkflowStep, uuid.UUID]] = []
        for step in steps:
            task_id = self._extract_task_id(step)
            if task_id is None:
                logger.warning(
                    "Step '%s' (order=%d) has no task_id; skipping.",
                    step.node_id, step.step_order,
                )
            else:
                runnable.append((step, task_id))

        if not runnable:
            return []

        coros = [
            self._execute_step_isolated(step, task_id, prior_output, semaphore)
            for step, task_id in runnable
        ]
        raw = await asyncio.gather(*coros, return_exceptions=True)

        outcomes: list[tuple[WorkflowStep, Optional[TaskExecution], Optional[str]]] = []
        for i, res in enumerate(raw):
            step = runnable[i][0]
            if isinstance(res, Exception):
                # _execute_step_isolated catches all exceptions; this is a last-resort guard.
                logger.error(
                    "Step '%s': unexpected exception escaped isolated execution: %s",
                    step.node_id, res,
                )
                outcomes.append((step, None, str(res)))
            else:
                outcomes.append(res)

        return outcomes

    async def _execute_step_isolated(
        self,
        step: WorkflowStep,
        task_id: uuid.UUID,
        prior_output: Optional[str],
        semaphore: asyncio.Semaphore,
    ) -> tuple[WorkflowStep, Optional[TaskExecution], Optional[str]]:
        """
        Execute one step with its own isolated AsyncSession under the semaphore.
        Never raises — all exceptions are caught and returned as the error string.
        """
        async with semaphore:
            async with AsyncSessionLocal() as db:
                try:
                    # Load task
                    task_result = await db.execute(
                        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
                    )
                    task = task_result.scalar_one_or_none()
                    if task is None:
                        return step, None, f"Task {task_id} not found."

                    # Resolve agent (step-level takes priority over task assignment)
                    agent_id = step.agent_id or task.assigned_to
                    if agent_id is None:
                        return step, None, (
                            f"Step '{step.node_id}' has no agent_id and "
                            f"task {task_id} has no assigned agent."
                        )
                    agent_check = await db.execute(
                        select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
                    )
                    if agent_check.scalar_one_or_none() is None:
                        return step, None, f"Agent {agent_id} not found."

                    # Create TaskExecution
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

                    logger.info(
                        "Step '%s' task_id=%s agent_id=%s execution_id=%s | parallel | starting",
                        step.node_id, task_id, agent_id, execution.id,
                    )

                    engine = _WorkflowStepEngine(db, prior_step_output=prior_output)
                    result = await engine.run(agent_id, task_id, execution.id)
                    return step, result, None

                except Exception as exc:
                    logger.exception(
                        "WorkflowExecutionEngine: unhandled error on parallel step '%s': %s",
                        step.node_id, exc,
                    )
                    return step, None, str(exc)

    async def _execute_sequential_fallback(
        self,
        steps: list[WorkflowStep],
        prior_output: Optional[str],
    ) -> list[tuple[WorkflowStep, Optional[TaskExecution], Optional[str]]]:
        """
        Fallback: execute a parallel group sequentially (used when gather fails).
        Delegates to the original _execute_step so behaviour is identical to
        the existing sequential path.
        """
        outcomes: list[tuple[WorkflowStep, Optional[TaskExecution], Optional[str]]] = []
        for step in steps:
            task_id = self._extract_task_id(step)
            if task_id is None:
                logger.warning(
                    "Step '%s' (order=%d) has no task_id; skipping.",
                    step.node_id, step.step_order,
                )
                continue
            result, error = await self._execute_step(step, task_id, prior_output)
            outcomes.append((step, result, error))
        return outcomes

    # -------------------------------------------------------------------------
    # Step execution (sequential — unchanged from original)
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
