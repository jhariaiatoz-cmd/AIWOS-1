import logging
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import AsyncSessionLocal, get_db
from app.models.agent_handoff import AgentHandoff
from app.models.user import User
from app.models.workflow import Workflow
from app.models.workflow_execution import WorkflowExecution
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


async def _run_workflow_bg(
    workflow_id: uuid.UUID,
    organization_id: uuid.UUID,
    wf_exec_id: uuid.UUID,
) -> None:
    """Run a workflow execution in the background using its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            logger.info(
                "Background workflow %s | execution_id=%s | starting",
                workflow_id, wf_exec_id,
            )
            engine = WorkflowExecutionEngine(db)
            await engine.run(workflow_id, organization_id, wf_exec_id=wf_exec_id)
        except Exception as exc:
            logger.exception(
                "Background workflow %s | execution_id=%s | unhandled error: %s",
                workflow_id, wf_exec_id, exc,
            )
            # Last-resort: mark workflow execution as failed so it never stays "running".
            try:
                async with AsyncSessionLocal() as recovery_db:
                    result = await recovery_db.execute(
                        select(WorkflowExecution).where(
                            WorkflowExecution.id == wf_exec_id,
                            WorkflowExecution.deleted_at.is_(None),
                        )
                    )
                    wf_exec = result.scalar_one_or_none()
                    if wf_exec and wf_exec.status not in ("completed", "failed"):
                        wf_exec.status = "failed"
                        wf_exec.error_message = f"Unexpected error: {exc}"
                        wf_exec.completed_at = datetime.now(timezone.utc)
                        await recovery_db.commit()
                        logger.info(
                            "Background workflow %s | execution_id=%s | marked failed after exception",
                            workflow_id, wf_exec_id,
                        )
            except Exception:
                logger.exception(
                    "Background workflow %s | execution_id=%s | recovery commit failed",
                    workflow_id, wf_exec_id,
                )


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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkflowExecutionResponse:
    """
    Dispatch all steps of a workflow sequentially as a background task.
    Returns a WorkflowExecution with status="running" immediately.
    Poll GET /{workflow_id}/executions/{execution_id} for status updates.
    Each WorkflowStep must have config["task_id"] set to an existing Task UUID.
    """
    workflow = await get_workflow(db, workflow_id)

    # Create the execution record upfront so the client gets an ID to poll.
    wf_exec = WorkflowExecution(
        id=uuid.uuid4(),
        workflow_id=workflow_id,
        organization_id=workflow.organization_id,
        status="running",
        completed_steps=[],
        failed_steps=[],
        step_outputs={},
        started_at=datetime.now(timezone.utc),
    )
    db.add(wf_exec)
    await db.commit()
    await db.refresh(wf_exec)

    logger.info(
        "Workflow %s | execution_id=%s | dispatched to background",
        workflow_id, wf_exec.id,
    )

    background_tasks.add_task(
        _run_workflow_bg,
        workflow_id,
        workflow.organization_id,
        wf_exec.id,
    )
    return wf_exec


@router.get(
    "/{workflow_id}/executions/{execution_id}",
    response_model=WorkflowExecutionResponse,
)
async def get_workflow_execution_status(
    workflow_id: uuid.UUID,
    execution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> WorkflowExecution:
    """Poll the status of a workflow execution."""
    result = await db.execute(
        select(WorkflowExecution).where(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.workflow_id == workflow_id,
            WorkflowExecution.deleted_at.is_(None),
        )
    )
    wf_exec = result.scalar_one_or_none()
    if wf_exec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow execution not found.",
        )
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
