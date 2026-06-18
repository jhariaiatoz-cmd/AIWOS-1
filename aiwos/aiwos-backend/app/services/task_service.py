import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


async def create_tasks_from_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    milestones: List[str],
    tasks: List[str],
    priority: str = "Medium",
    owner_agent_id: Optional[uuid.UUID] = None,
) -> List[Task]:
    existing_result = await db.execute(
        select(Task.title).where(
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
    )
    seen = {row[0] for row in existing_result.all()}

    to_create: List[Task] = []

    for ms in milestones:
        title = ms.strip()[:255]
        if title and title not in seen:
            to_create.append(Task(
                id=uuid.uuid4(),
                organization_id=organization_id,
                project_id=project_id,
                title=title,
                priority=priority,
                status="Todo",
                assigned_to=owner_agent_id,
            ))
            seen.add(title)

    for task_title in tasks:
        title = task_title.strip()[:255]
        if title and title not in seen:
            to_create.append(Task(
                id=uuid.uuid4(),
                organization_id=organization_id,
                project_id=project_id,
                title=title,
                priority=priority,
                status="Todo",
                assigned_to=owner_agent_id,
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
