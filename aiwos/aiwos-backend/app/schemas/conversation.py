import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


# ── Agent summary embedded in conversation responses ─────────────────────────

class AgentSummary(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    status: str
    provider: Optional[str] = None
    model: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Message ───────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: str
    sender_id: uuid.UUID
    content: str
    payload: Optional[Any] = None
    execution_id: Optional[uuid.UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Conversation ──────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    agent_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    # If provided, the backend matches the best agent (when agent_id is None)
    # and sends this as the first message, returning a seeded conversation.
    prompt: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str


class ConversationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    agent_id: Optional[uuid.UUID] = None
    title: str
    context_type: str
    context_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    agent: Optional[AgentSummary] = None
    model_config = ConfigDict(from_attributes=True)
