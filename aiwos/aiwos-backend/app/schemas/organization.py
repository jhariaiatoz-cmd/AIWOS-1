import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Acme Corporation",
            "slug": "acme-corporation",
        }
    })

    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")


class OrganizationUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Acme Corp",
            "slug": "acme-corp",
        }
    })

    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
