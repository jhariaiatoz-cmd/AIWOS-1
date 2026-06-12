import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


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
    return task


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
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
        await db.refresh(task)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure assigned_to agent_id exists.",
        )
    return task


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> None:
    task = await get_task(db, task_id)
    task.delete()
    await db.commit()
