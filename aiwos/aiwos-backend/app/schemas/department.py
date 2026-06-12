import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "organization_id": "<organization_uuid>",
            "name": "Engineering",
            "description": "Software engineering and development team",
            "is_custom": True,
        }
    })

    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_custom: bool = True


class DepartmentUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Engineering (Updated)",
            "description": "Updated description for the engineering team",
            "is_custom": True,
        }
    })

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_custom: bool | None = None


class DepartmentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    is_custom: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
