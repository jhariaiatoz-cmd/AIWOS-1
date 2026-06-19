import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.task_assignment_service import assign_task

if TYPE_CHECKING:
    from app.models.agent import Agent

# Deterministic phase → specialist role mapping
PHASE_ROLE_MAP: Dict[str, str] = {
    "Research": "Research Analyst",
    "Design": "UI/UX Designer",
    "Development": "Full Stack Engineer",
    "Testing": "QA Engineer",
    "Deployment": "DevOps Engineer",
}


def _find_agent_by_role(target_role: str, agents: "List[Agent]") -> "Optional[uuid.UUID]":
    """Return the first agent whose role contains the target role keywords."""
    target_lower = target_role.lower()
    # Exact or substring match first
    for agent in agents:
        if target_lower in (agent.role or "").lower():
            return agent.id
    # Partial keyword match as fallback
    keywords = [w for w in target_lower.split() if len(w) > 3]
    for agent in agents:
        role_lower = (agent.role or "").lower()
        if any(kw in role_lower for kw in keywords):
            return agent.id
    return None


async def create_tasks_from_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    milestones: List[str],
    tasks: List[str],
    priority: str = "Medium",
    owner_agent_id: Optional[uuid.UUID] = None,
    agents: "Optional[List[Agent]]" = None,
    phase_tasks: Optional[List[Dict[str, Any]]] = None,
) -> List[Task]:
    existing_result = await db.execute(
        select(Task.title).where(
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
    )
    seen = {row[0] for row in existing_result.all()}

    to_create: List[Task] = []
    available_agents: "List[Agent]" = agents or []

    if phase_tasks:
        # Structured phase-based creation: assign via phase→role mapping
        for pt in phase_tasks:
            title = (pt.get("title") or "").strip()[:255]
            if not title or title in seen:
                continue
            phase = pt.get("phase") or None
            suggested_role = pt.get("suggested_role") or (PHASE_ROLE_MAP.get(phase, "") if phase else "")
            description = pt.get("description") or None

            assigned: Optional[uuid.UUID] = None
            if suggested_role and available_agents:
                assigned = _find_agent_by_role(suggested_role, available_agents)
            if assigned is None:
                assigned = assign_task(title, description, available_agents)
            assigned = assigned or owner_agent_id

            to_create.append(Task(
                id=uuid.uuid4(),
                organization_id=organization_id,
                project_id=project_id,
                title=title,
                description=description,
                priority=priority,
                status="Todo",
                phase=phase,
                assigned_to=assigned,
            ))
            seen.add(title)
    else:
        # Backward-compatible flat milestones + tasks creation
        for ms in milestones:
            title = ms.strip()[:255]
            if title and title not in seen:
                assigned = assign_task(title, None, available_agents) or owner_agent_id
                to_create.append(Task(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    project_id=project_id,
                    title=title,
                    priority=priority,
                    status="Todo",
                    assigned_to=assigned,
                ))
                seen.add(title)

        for task_title in tasks:
            title = task_title.strip()[:255]
            if title and title not in seen:
                assigned = assign_task(title, None, available_agents) or owner_agent_id
                to_create.append(Task(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    project_id=project_id,
                    title=title,
                    priority=priority,
                    status="Todo",
                    assigned_to=assigned,
                ))
                seen.add(title)

    for t in to_create:
        db.add(t)

    try:
        await db.commit()
        for t in to_create:
            await db.refresh(t)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure project_id and organization_id exist.",
        )

    # Re-fetch with assigned_agent eagerly loaded
    if not to_create:
        return []
    ids = [t.id for t in to_create]
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assigned_agent))
        .where(Task.id.in_(ids))
        .order_by(Task.created_at)
    )
    return list(result.scalars().all())


async def create_task(
    db: AsyncSession,
    body: TaskCreate,
    current_user_id: uuid.UUID,
) -> Task:
    task = Task(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        status=body.status,
        phase=body.phase,
        assigned_to=body.assigned_to,
        due_date=body.due_date,
    )
    db.add(task)
    try:
        await db.commit()
        await db.refresh(task)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure organization_id and project_id exist.",
        )
    return await get_task(db, task.id)


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assigned_agent))
        .where(Task.id == task_id, Task.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return task


async def list_tasks(
    db: AsyncSession,
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Task]:
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assigned_agent))
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
        .order_by(Task.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    body: TaskUpdate,
) -> Task:
    task = await get_task(db, task_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure assigned_to agent_id exists.",
        )
    return await get_task(db, task_id)


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> None:
    task = await get_task(db, task_id)
    task.delete()
    await db.commit()
