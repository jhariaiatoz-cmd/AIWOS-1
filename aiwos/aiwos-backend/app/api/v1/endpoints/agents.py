import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent import Agent
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentResponse, AgentUpdate
from app.services.agent_service import (
    create_agent,
    delete_agent,
    delete_all_agents,
    get_agent,
    list_agents,
    update_agent,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: AgentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Agent:
    return await create_agent(db, body)


@router.get("", response_model=List[AgentResponse])
async def list_all(
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Agent]:
    return await list_agents(db, organization_id, skip=skip, limit=limit, status_filter=status)


@router.delete("", status_code=status.HTTP_200_OK)
async def delete_all(
    organization_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    count = await delete_all_agents(db, organization_id)
    return {"deleted": count}


@router.get("/{agent_id}/workload")
async def get_workload(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    projects_owned = await db.scalar(
        select(func.count()).where(
            Project.owner_agent_id == agent_id,
            Project.deleted_at.is_(None),
        )
    ) or 0
    tasks_assigned = await db.scalar(
        select(func.count()).where(
            Task.assigned_to == agent_id,
            Task.deleted_at.is_(None),
        )
    ) or 0
    return {"projects_owned": projects_owned, "tasks_assigned": tasks_assigned}


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_one(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Agent:
    return await get_agent(db, agent_id)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_one(
    agent_id: uuid.UUID,
    body: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Agent:
    return await update_agent(db, agent_id, body)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_agent(db, agent_id)
