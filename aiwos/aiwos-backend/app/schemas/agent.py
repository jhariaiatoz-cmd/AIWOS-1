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
            "name": "Senior Full Stack Engineer",
            "role": "Engineering Lead",
            "goal": "Design and build production-grade web applications with modern tooling.",
            "instructions": "Provide technical architecture guidance, code reviews, and implementation support. Always follow best practices for security, performance, and maintainability.",
            "skills": ["React", "Next.js", "FastAPI", "PostgreSQL", "System Design"],
            "provider": "openai",
            "model": "gpt-4o",
            "memory_config": None,
            "tools": [],
            "permissions": None,
            "status": "Active",
            "is_manager": False,
        }
    })

    organization_id: uuid.UUID
    department_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    goal: str
    instructions: str
    skills: list[str] = Field(default_factory=list)
    provider: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=255)
    memory_config: Any | None = None
    tools: list[Any] = Field(default_factory=list)
    permissions: Any | None = None
    status: AgentStatus = "Active"
    is_manager: bool = False


class AgentUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "department_id": "<department_uuid>",
            "name": "Principal Engineer",
            "role": "Engineering Lead",
            "goal": "Lead engineering initiatives and mentor junior engineers",
            "instructions": "Coordinate technical strategy, review architecture decisions, and ensure delivery quality.",
            "skills": ["React", "Next.js", "FastAPI", "PostgreSQL", "System Design", "Team Leadership"],
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
    skills: list[str] | None = None
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
    skills: list[str]
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
