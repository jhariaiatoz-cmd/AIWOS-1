import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import Workflow
from app.models.workflow_step import WorkflowStep
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate


async def create_workflow(db: AsyncSession, body: WorkflowCreate) -> Workflow:
    workflow = Workflow(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        name=body.name,
        description=body.description,
        graph_definition=body.graph_definition,
        status=body.status,
    )
    for step_body in body.steps:
        workflow.steps.append(
            WorkflowStep(
                id=uuid.uuid4(),
                name=step_body.name,
                node_id=step_body.node_id,
                step_order=step_body.step_order,
                agent_id=step_body.agent_id,
                config=step_body.config,
            )
        )
    db.add(workflow)
    try:
        await db.commit()
        await db.refresh(workflow)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure organization_id and any agent_id in steps exist.",
        )
    return await _load(db, workflow.id)


async def get_workflow(db: AsyncSession, workflow_id: uuid.UUID) -> Workflow:
    workflow = await _load(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
    return workflow


async def list_workflows(
    db: AsyncSession,
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Workflow]:
    result = await db.execute(
        select(Workflow)
        .where(Workflow.organization_id == organization_id, Workflow.deleted_at.is_(None))
        .options(selectinload(Workflow.steps))
        .order_by(Workflow.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_workflow(
    db: AsyncSession,
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
) -> Workflow:
    workflow = await get_workflow(db, workflow_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid foreign key reference. Ensure all referenced IDs exist.",
        )
    return await _load(db, workflow_id)


async def delete_workflow(db: AsyncSession, workflow_id: uuid.UUID) -> None:
    workflow = await get_workflow(db, workflow_id)
    workflow.delete()
    await db.commit()


async def _load(db: AsyncSession, workflow_id: uuid.UUID) -> Workflow | None:
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id, Workflow.deleted_at.is_(None))
        .options(selectinload(Workflow.steps))
    )
    return result.scalar_one_or_none()
