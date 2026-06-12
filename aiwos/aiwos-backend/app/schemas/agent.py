import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

AgentStatus = Literal["Created", "Active", "Paused", "Retired"]


class AgentCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "organization_id": "<organization_uuid>",
            "department_id": "<department_uuid>",
            "name": "Research Assistant",
            "role": "Researcher",
            "goal": "Gather and analyze information from various sources",
            "instructions": "Search for relevant data, summarize findings, and present insights",
            "provider": "anthropic",
            "model": "claude-sonnet-4-6",
            "memory_config": None,
            "tools": [],
            "permissions": None,
            "status": "Created",
            "is_manager": False,
        }
    })

    organization_id: uuid.UUID
    department_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    goal: str
    instructions: str
    provider: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=255)
    memory_config: Any | None = None
    tools: list[Any] = Field(default_factory=list)
    permissions: Any | None = None
    status: AgentStatus = "Created"
    is_manager: bool = False


class AgentUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "department_id": "<department_uuid>",
            "name": "Senior Research Assistant",
            "role": "Lead Researcher",
            "goal": "Lead research initiatives and mentor junior agents",
            "instructions": "Coordinate research tasks and review findings",
            "provider": "openai",
            "model": "gpt-4o",
            "status": "Active",
            "is_manager": True,
        }
    })

    department_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    role: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    instructions: str | None = None
    provider: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=255)
    memory_config: Any | None = None
    tools: list[Any] | None = None
    permissions: Any | None = None
    status: AgentStatus | None = None
    is_manager: bool | None = None


class AgentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    department_id: uuid.UUID | None
    name: str
    role: str
    goal: str
    instructions: str
    provider: str | None
    model: str | None
    memory_config: Any | None
    tools: Any
    permissions: Any | None
    status: str
    is_manager: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
