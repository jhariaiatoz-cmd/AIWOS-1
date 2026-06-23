import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import AsyncSessionLocal, get_db
from app.models.task_execution import TaskExecution
from app.models.user import User
from app.schemas.execution import (
    ExecuteTaskRequest,
    ExecuteTaskResponse,
    ExecutionResponse,
)
from app.services.execution_service import (
    cancel_execution,
    create_execution,
    get_execution,
    list_executions,
    run_execution,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["executions"])


async def _run_execution_bg(execution_id: uuid.UUID) -> None:
    """Run an execution in the background using its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            await run_execution(db, execution_id)
        except ValueError as exc:
            # Already logged inside run_execution; nothing more to do.
            logger.warning("Background execution %s: %s", execution_id, exc)
        except BaseException as exc:
            # Catches CancelledError and any other BaseException subclass that
            # bypasses the engine's internal guard — last line of defence to
            # prevent the execution from staying "pending" or "running" forever.
            logger.exception("Background execution %s: unhandled base error", execution_id)
            try:
                async with AsyncSessionLocal() as recovery_db:
                    result = await recovery_db.execute(
                        select(TaskExecution).where(
                            TaskExecution.id == execution_id,
                            TaskExecution.deleted_at.is_(None),
                        )
                    )
                    exec_row = result.scalar_one_or_none()
                    if exec_row and exec_row.status not in ("completed", "failed", "cancelled"):
                        exec_row.status = "failed"
                        exec_row.error_message = f"Background task interrupted: {exc}"
                        exec_row.completed_at = datetime.now(timezone.utc)
                        await recovery_db.commit()
                        logger.info(
                            "Background execution %s: marked failed after base exception",
                            execution_id,
                        )
            except Exception:
                logger.exception(
                    "Background execution %s: recovery commit also failed", execution_id
                )


@router.post(
    "/tasks/{task_id}/execute",
    response_model=ExecuteTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_task(
    task_id: uuid.UUID,
    body: ExecuteTaskRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExecuteTaskResponse:
    try:
        execution = await create_execution(db, task_id, agent_id=body.agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    # Dispatch LLM execution as a background task so the HTTP response is
    # returned immediately.  The client polls GET /executions/{id} for status.
    background_tasks.add_task(_run_execution_bg, execution.id)
    return ExecuteTaskResponse(execution_id=execution.id, status=execution.status)


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_one(
    execution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExecutionResponse:
    try:
        execution = await get_execution(db, execution_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return execution


@router.get("/executions", response_model=List[ExecutionResponse])
async def list_all(
    task_id: Optional[uuid.UUID] = None,
    agent_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[ExecutionResponse]:
    return await list_executions(
        db,
        task_id=task_id,
        agent_id=agent_id,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.post("/executions/{execution_id}/cancel", response_model=ExecutionResponse)
async def cancel_one(
    execution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExecutionResponse:
    try:
        execution = await cancel_execution(db, execution_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return execution
