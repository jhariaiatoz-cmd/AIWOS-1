import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowResponse, WorkflowUpdate
from app.services import notification_service
from app.services.workflow_service import (
    create_workflow,
    delete_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workflow:
    workflow = await create_workflow(db, body)
    try:
        await notification_service.create_notification(
            db,
            organization_id=body.organization_id,
            type="workflow_created",
            title=f"Workflow created: {workflow.name}",
            body=workflow.description,
            entity_id=workflow.id,
            entity_type="workflow",
            user_id=current_user.id,
        )
    except Exception:
        pass
    return workflow


@router.get("", response_model=List[WorkflowResponse])
async def list_all(
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Workflow]:
    return await list_workflows(db, organization_id, skip=skip, limit=limit)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_one(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Workflow:
    return await get_workflow(db, workflow_id)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_one(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Workflow:
    return await update_workflow(db, workflow_id, body)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_workflow(db, workflow_id)
