import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    type: str
    title: str
    body: str | None
    entity_id: uuid.UUID | None
    entity_type: str | None
    is_read: bool
    created_at: datetime
