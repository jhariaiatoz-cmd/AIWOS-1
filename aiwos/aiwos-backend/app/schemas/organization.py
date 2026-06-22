import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    industry: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None)


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    industry: str | None = None
    timezone: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    joined_at: datetime

    model_config = {"from_attributes": False}


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="Viewer", pattern=r"^(Admin|Manager|Editor|Viewer)$")


class InvitationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    role: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class InvitationPublicResponse(BaseModel):
    """Public info returned to the accept-invite page (no sensitive fields)."""
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    email: str
    role: str
    status: str
    expires_at: datetime


class InvitationAccept(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


class InvitationAcceptResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    organization_id: uuid.UUID
