import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent import Agent
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskBulkFromProject, TaskBulkResponse, TaskCreate, TaskResponse, TaskUpdate
from app.services.task_service import (
    create_task,
    create_tasks_from_project,
    delete_task,
    get_task,
    list_tasks,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    return await create_task(db, body, current_user.id)


@router.get("", response_model=List[TaskResponse])
async def list_all(
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Task]:
    return await list_tasks(db, project_id, skip=skip, limit=limit)


@router.post("/from-project", response_model=TaskBulkResponse, status_code=status.HTTP_201_CREATED)
async def create_from_project(
    body: TaskBulkFromProject,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    agents_result = await db.execute(
        select(Agent).where(
            Agent.organization_id == body.organization_id,
            Agent.deleted_at.is_(None),
        )
    )
    agents = list(agents_result.scalars().all())

    created = await create_tasks_from_project(
        db,
        project_id=body.project_id,
        organization_id=body.organization_id,
        milestones=body.milestones,
        tasks=body.tasks,
        priority=body.priority,
        owner_agent_id=body.owner_agent_id,
        agents=agents,
        phase_tasks=[pt.model_dump() for pt in body.phase_tasks] if body.phase_tasks else None,
    )
    return {"created": created, "count": len(created)}


@router.get("/{task_id}", response_model=TaskResponse)
async def get_one(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Task:
    return await get_task(db, task_id)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_one(
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Task:
    return await update_task(db, task_id, body)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_task(db, task_id)
