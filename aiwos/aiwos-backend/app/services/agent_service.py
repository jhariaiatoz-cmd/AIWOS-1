import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate


async def create_agent(db: AsyncSession, body: AgentCreate) -> Agent:
    agent = Agent(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        department_id=body.department_id,
        name=body.name,
        role=body.role,
        goal=body.goal,
        instructions=body.instructions,
        skills=body.skills,
        provider=body.provider,
        model=body.model,
        memory_config=body.memory_config,
        tools=body.tools,
        permissions=body.permissions,
        status=body.status,
        is_manager=body.is_manager,
    )
    db.add(agent)
    try:
        await db.commit()
        await db.refresh(agent)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure organization_id and department_id exist.",
        )
    return agent


async def get_agent(db: AsyncSession, agent_id: uuid.UUID) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return agent


async def list_agents(
    db: AsyncSession,
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
) -> List[Agent]:
    q = (
        select(Agent)
        .where(Agent.organization_id == organization_id, Agent.deleted_at.is_(None))
        .order_by(Agent.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if status_filter:
        q = q.where(Agent.status == status_filter)
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_agent(
    db: AsyncSession,
    agent_id: uuid.UUID,
    body: AgentUpdate,
) -> Agent:
    agent = await get_agent(db, agent_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    try:
        await db.commit()
        await db.refresh(agent)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure department_id exists.",
        )
    return agent


async def delete_agent(db: AsyncSession, agent_id: uuid.UUID) -> None:
    agent = await get_agent(db, agent_id)
    agent.delete()
    await db.commit()


async def delete_all_agents(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(Agent).where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
        )
    )
    agents = list(result.scalars().all())
    for agent in agents:
        agent.delete()
    await db.commit()
    return len(agents)
