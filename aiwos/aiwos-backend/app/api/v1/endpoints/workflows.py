import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent_handoff import AgentHandoff
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.workflow import (
    AgentHandoffResponse,
    WorkflowCreate,
    WorkflowExecutionResponse,
    WorkflowResponse,
    WorkflowUpdate,
)
from app.services import notification_service
from app.services.workflow_execution_engine import WorkflowExecutionEngine
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


@router.post(
    "/{workflow_id}/execute",
    response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkflowExecutionResponse:
    """
    Run all steps of a workflow sequentially.
    Each WorkflowStep must have config["task_id"] set to an existing Task UUID.
    Execution stops immediately on any step failure.
    """
    workflow = await get_workflow(db, workflow_id)
    try:
        engine = WorkflowExecutionEngine(db)
        wf_exec = await engine.run(workflow_id, workflow.organization_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return wf_exec


@router.get(
    "/{workflow_id}/executions/{execution_id}/handoffs",
    response_model=List[AgentHandoffResponse],
)
async def list_handoffs(
    workflow_id: uuid.UUID,
    execution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[AgentHandoff]:
    """
    Return all agent-to-agent handoffs for a workflow execution in step order.
    Each handoff records the content passed from one agent to the next.
    """
    result = await db.execute(
        select(AgentHandoff)
        .where(AgentHandoff.workflow_execution_id == execution_id)
        .order_by(AgentHandoff.source_step_order)
    )
    return result.scalars().all()
