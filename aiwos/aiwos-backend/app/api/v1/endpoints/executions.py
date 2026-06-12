import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
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

router = APIRouter(tags=["executions"])


@router.post(
    "/tasks/{task_id}/execute",
    response_model=ExecuteTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_task(
    task_id: uuid.UUID,
    body: ExecuteTaskRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExecuteTaskResponse:
    try:
        execution = await create_execution(db, task_id, agent_id=body.agent_id)
        execution = await run_execution(db, execution.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
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
