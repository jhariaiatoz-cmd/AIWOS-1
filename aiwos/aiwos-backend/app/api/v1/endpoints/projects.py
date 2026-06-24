import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    return await create_project(db, body, current_user.id)


@router.get("", response_model=List[ProjectResponse])
async def list_all(
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Project]:
    return await list_projects(db, organization_id, skip=skip, limit=limit)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_one(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Project:
    project = await get_project(db, project_id)
    has_blueprint = project.blueprint is not None
    has_prompt_pack = bool(
        project.blueprint and project.blueprint.get("prompt_pack")
    )
    log.info(
        "[blueprint] GET project id=%s has_blueprint=%s has_prompt_pack=%s",
        project_id, has_blueprint, has_prompt_pack,
    )
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_one(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Project:
    return await update_project(db, project_id, body)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_project(db, project_id)
