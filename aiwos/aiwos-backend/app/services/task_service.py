import logging
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

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.models.agent import Agent

# Deterministic phase → specialist role/name mapping
PHASE_ROLE_MAP: Dict[str, str] = {
    "Research": "Research Analyst",
    "Design": "UI/UX Designer",
    "Development": "Senior Full Stack Engineer",
    "Testing": "QA Engineer",
    "Deployment": "DevOps Engineer",
    "Planning": "Project Manager",
    "Initiation": "Product Manager",
    "Architecture": "AI Solution Architect",
    "Security": "Cybersecurity Specialist",
    "Frontend": "UI/UX Designer",
    "Backend": "Backend Engineer",
    "QA": "QA Engineer",
}

# Task title keyword → specialist name mapping (matched when phase/role don't resolve)
_TASK_KEYWORD_ROLE_MAP: List[tuple] = [
    # Project management / planning tasks
    ({"charter", "project charter"}, "Product Manager"),
    ({"wbs", "work breakdown", "work breakdown structure"}, "Project Manager"),
    ({"resource assignment", "resource plan", "resource allocation"}, "Project Manager"),
    ({"schedule", "schedule development", "project schedule", "timeline"}, "Project Manager"),
    ({"stakeholder", "stakeholder register", "stakeholder analysis"}, "Project Manager"),
    ({"risk register", "risk management", "risk assessment"}, "Project Manager"),
    ({"project plan", "project planning", "kick-off", "kickoff"}, "Project Manager"),
    # Architecture tasks
    ({"architecture", "system design", "solution design", "tech stack", "technical design"}, "AI Solution Architect"),
    # Security tasks
    ({"security", "penetration", "vulnerability", "compliance", "audit", "threat"}, "Cybersecurity Specialist"),
    # Frontend tasks
    ({"frontend", "front-end", "ui", "ux", "wireframe", "mockup", "prototype"}, "UI/UX Designer"),
    # Backend tasks
    ({"backend", "back-end", "api", "database", "server", "microservice"}, "Backend Engineer"),
    # QA tasks
    ({"testing", "qa", "quality assurance", "test plan", "test cases"}, "QA Engineer"),
]


def _find_agent_by_role(target_role: str, agents: "List[Agent]") -> "Optional[uuid.UUID]":
    """Return the first agent whose name or role contains the target role keywords."""
    target_lower = target_role.lower()
    # Search agent.name first (names like "Product Manager" are most descriptive)
    for agent in agents:
        if target_lower in (agent.name or "").lower():
            return agent.id
    # Then search agent.role
    for agent in agents:
        if target_lower in (agent.role or "").lower():
            return agent.id
    # Partial keyword match on name + role combined: require ALL significant words
    keywords = [w for w in target_lower.split() if len(w) >= 2]
    if keywords:
        for agent in agents:
            combined = f"{agent.name or ''} {agent.role or ''}".lower()
            if all(kw in combined for kw in keywords):
                return agent.id
    return None


def _find_agent_by_task_title(title: str, agents: "List[Agent]") -> "Optional[uuid.UUID]":
    """Match task title keywords to a specialist role, then find the agent."""
    title_lower = title.lower()
    for keywords, role_name in _TASK_KEYWORD_ROLE_MAP:
        if any(kw in title_lower for kw in keywords):
            agent_id = _find_agent_by_role(role_name, agents)
            if agent_id is not None:
                return agent_id
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
            fallback_used = False
            if suggested_role and available_agents:
                assigned = _find_agent_by_role(suggested_role, available_agents)
            if assigned is None and available_agents:
                assigned = _find_agent_by_task_title(title, available_agents)
            if assigned is None:
                assigned = assign_task(title, description, available_agents)
            if assigned is None:
                assigned = owner_agent_id
                fallback_used = True

            assigned_agent_name = next(
                (a.name for a in available_agents if a.id == assigned), "None"
            )
            logger.debug(
                "Task assignment | Project: %s | Task: %s | Phase: %s | "
                "Expected Role: %s | Assigned Agent: %s | Fallback Used: %s",
                project_id,
                title,
                phase or "None",
                suggested_role or "None",
                assigned_agent_name,
                fallback_used,
            )

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
