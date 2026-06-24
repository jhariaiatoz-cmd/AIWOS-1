import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectUpdate


async def _attach_progress(db: AsyncSession, project: Project) -> None:
    total = await db.scalar(
        select(func.count()).where(Task.project_id == project.id, Task.deleted_at.is_(None))
    ) or 0
    done = await db.scalar(
        select(func.count()).where(
            Task.project_id == project.id,
            Task.status == "Done",
            Task.deleted_at.is_(None),
        )
    ) or 0
    project.total_tasks = total  # type: ignore[attr-defined]
    project.completed_tasks = done  # type: ignore[attr-defined]
    project.progress = round((done / total) * 100) if total > 0 else 0  # type: ignore[attr-defined]


async def create_project(
    db: AsyncSession,
    body: ProjectCreate,
    current_user_id: uuid.UUID,
) -> Project:
    project = Project(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        name=body.name,
        description=body.description,
        status=body.status,
        created_by=current_user_id,
        owner_agent_id=body.owner_agent_id,
    )
    db.add(project)
    try:
        await db.commit()
        await db.refresh(project)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure organization_id and owner_agent_id exist.",
        )
    # Re-fetch with owner_agent eagerly loaded
    return await get_project(db, project.id)


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner_agent))
        .where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    await _attach_progress(db, project)
    return project


async def list_projects(
    db: AsyncSession,
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Project]:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner_agent))
        .where(Project.organization_id == organization_id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    projects = list(result.scalars().all())
    for p in projects:
        await _attach_progress(db, p)
    return projects


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    body: ProjectUpdate,
) -> Project:
    project = await get_project(db, project_id)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.commit()
    return await get_project(db, project_id)


async def delete_project(db: AsyncSession, project_id: uuid.UUID) -> None:
    project = await get_project(db, project_id)
    project.delete()
    await db.commit()
