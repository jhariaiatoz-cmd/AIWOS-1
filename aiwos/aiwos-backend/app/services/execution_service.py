import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_metric import AgentMetric
from app.models.execution_log import ExecutionLog
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.services.llm_provider_service import complete as llm_complete

_DEFAULT_MODEL = "gemini-2.5-flash"

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
    agent = await _resolve_agent(db, execution, task)

    # Stamp running state
    execution.status = "running"
    execution.agent_id = agent.id
    execution.started_at = datetime.now(timezone.utc)
    await db.commit()

    system_prompt = _build_system_prompt(agent)
    user_prompt = _build_user_prompt(task)
    execution.input_data = {"system_prompt": system_prompt, "user_prompt": user_prompt}

    model = agent.model or _DEFAULT_MODEL
    started_at = execution.started_at

    try:
        llm_response = await llm_complete(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
    except Exception as exc:
        completed_at = datetime.now(timezone.utc)
        elapsed_ms = int((completed_at - started_at).total_seconds() * 1000)

        execution.status = "failed"
        execution.error_message = str(exc)
        execution.completed_at = completed_at
        execution.execution_time_ms = elapsed_ms

        await db.commit()

        await _insert_execution_log(
            db,
            execution=execution,
            agent=agent,
            task=task,
            status="failed",
            error_message=str(exc),
            elapsed_ms=elapsed_ms,
        )
        await _upsert_agent_metric(
            db,
            organization_id=execution.organization_id,
            agent_id=agent.id,
            tasks_failed=1,
        )
        return execution

    # Success path
    completed_at = datetime.now(timezone.utc)
    elapsed_ms = int((completed_at - started_at).total_seconds() * 1000)

    execution.status = "completed"
    execution.output_data = {"content": llm_response.content}
    execution.token_count = llm_response.input_tokens + llm_response.output_tokens
    execution.cost = llm_response.cost
    execution.completed_at = completed_at
    execution.execution_time_ms = elapsed_ms

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
    agent_id = execution.agent_id or task.assigned_to
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


def _build_system_prompt(agent: Agent) -> str:
    parts = []
    if agent.goal:
        parts.append(f"Goal: {agent.goal}")
    if agent.instructions:
        parts.append(agent.instructions)
    return "\n\n".join(parts)


def _build_user_prompt(task: Task) -> str:
    parts = [task.title]
    if task.description:
        parts.append(task.description)
    return "\n\n".join(parts)


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
