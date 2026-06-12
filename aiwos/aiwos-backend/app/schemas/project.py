import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProjectStatus = Literal["Planning", "Active", "Completed", "Archived"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "organization_id": "<organization_uuid>",
            "name": "Website Redesign",
            "description": "Redesign the company website with a modern UI and improved UX",
            "status": "Planning",
        }
    })

    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus = "Planning"


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Website Redesign Phase 2",
            "description": "Second phase with additional features",
            "status": "Active",
        }
    })

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    status: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
