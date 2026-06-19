import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

TaskPriority = Literal["Low", "Medium", "High", "Critical"]
TaskStatus = Literal["Todo", "In Progress", "Review", "Done", "Cancelled"]


class AssignedAgentInfo(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "organization_id": "<organization_uuid>",
            "project_id": "<project_uuid>",
            "title": "Implement login page",
            "description": "Create a responsive login page with email and password fields",
            "priority": "Medium",
            "status": "Todo",
            "assigned_to": "<agent_uuid>",
            "due_date": None,
        }
    })

    organization_id: uuid.UUID
    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    priority: TaskPriority = "Medium"
    status: TaskStatus = "Todo"
    phase: str | None = None
    assigned_to: uuid.UUID | None = None
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "title": "Implement login page (revised)",
            "description": "Updated requirements for the login page",
            "priority": "High",
            "status": "In Progress",
            "assigned_to": "<agent_uuid>",
            "due_date": None,
            "completed_at": None,
        }
    })

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    assigned_to: uuid.UUID | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    project_id: uuid.UUID
    assigned_to: uuid.UUID | None
    assigned_agent: AssignedAgentInfo | None = None
    title: str
    description: str | None
    priority: str
    status: str
    phase: str | None = None
    due_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhasedTask(BaseModel):
    """A task with an explicit project phase and suggested specialist role."""
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    phase: str | None = None          # Research | Design | Development | Testing | Deployment
    suggested_role: str | None = None  # e.g. "Research Analyst", "QA Engineer"


class TaskBulkFromProject(BaseModel):
    project_id: uuid.UUID
    organization_id: uuid.UUID
    milestones: list[str] = []
    tasks: list[str] = []
    phase_tasks: list[PhasedTask] = []  # structured phase-based tasks; takes priority when present
    priority: TaskPriority = "Medium"
    owner_agent_id: Optional[uuid.UUID] = None


class TaskBulkResponse(BaseModel):
    created: list[TaskResponse]
    count: int
