import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    MessageResponse,
    SendMessageRequest,
)
from app.services import conversation_service

router = APIRouter(tags=["conversations"])


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationResponse:
    # Inject authenticated user_id if caller omitted it
    if body.user_id is None:
        body = body.model_copy(update={"user_id": current_user.id})
    conv = await conversation_service.create_conversation(db, body, background_tasks)
    return conv


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    organization_id: uuid.UUID = Query(...),
    agent_id: Optional[uuid.UUID] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[ConversationResponse]:
    return await conversation_service.list_conversations(
        db,
        organization_id=organization_id,
        agent_id=agent_id,
        user_id=user_id,
        skip=skip,
        limit=limit,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ConversationResponse:
    return await conversation_service.get_conversation_with_messages(db, conversation_id)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=List[MessageResponse],
    status_code=201,
)
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[MessageResponse]:
    return await conversation_service.send_message(
        db,
        conversation_id=conversation_id,
        content=body.content,
        user_id=current_user.id,
        background_tasks=background_tasks,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[MessageResponse],
)
async def get_messages(
    conversation_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[MessageResponse]:
    return await conversation_service.get_messages(db, conversation_id, skip=skip, limit=limit)
