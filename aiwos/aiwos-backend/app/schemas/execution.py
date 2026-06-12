import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel

ExecutionStatus = Literal["pending", "running", "completed", "failed", "cancelled"]


class ExecuteTaskRequest(BaseModel):
    agent_id: Optional[uuid.UUID] = None


class ExecuteTaskResponse(BaseModel):
    execution_id: uuid.UUID
    status: ExecutionStatus


class ExecutionResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    agent_id: Optional[uuid.UUID]
    organization_id: uuid.UUID
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    output_data: Optional[Any]
    error_message: Optional[str]
    token_count: int
    cost: float
    execution_time_ms: Optional[int]
    retry_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
