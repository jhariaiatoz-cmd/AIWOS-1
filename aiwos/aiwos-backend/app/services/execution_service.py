import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.services.agent_execution_engine import AgentExecutionEngine

import logging

logger = logging.getLogger(__name__)


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
    Execute a pending TaskExecution end-to-end by delegating to AgentExecutionEngine.
    Resolves the agent from the task assignment or the execution record, then hands
    off to the engine which owns the full lifecycle.
    """
    execution = await _get_execution(db, execution_id)
    if execution.status != "pending":
        raise ValueError(
            f"Cannot run execution with status '{execution.status}'. "
            "Only 'pending' executions can be started."
        )

    task = await _get_task(db, execution.task_id)
    agent = await _resolve_agent(db, execution, task)

    engine = AgentExecutionEngine(db)
    return await engine.run(agent.id, task.id, execution_id)


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
    # Prefer the specialist assigned to the task; only fall back to
    # execution.agent_id (set from the request body) when no specialist exists.
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
