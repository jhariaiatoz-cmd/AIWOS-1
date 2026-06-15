"""
Conversation service: create conversations, send messages, and maintain
multi-turn LLM context from stored history.
"""
import uuid
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import ConversationCreate
from app.services.agent_router import log_routing, route as route_agent
from app.services.llm_provider_service import complete as llm_complete

_HISTORY_WINDOW = 10   # how many prior messages to include as context
_FALLBACK_MODEL = "gemini-2.5-flash"


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conv


async def _get_agent(db: AsyncSession, agent_id: uuid.UUID) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.deleted_at.is_(None))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return agent


async def _list_agents_for_org(db: AsyncSession, org_id: uuid.UUID) -> List[Agent]:
    result = await db.execute(
        select(Agent).where(
            Agent.organization_id == org_id,
            Agent.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


def _build_system_prompt(agent: Agent) -> str:
    parts = []
    if agent.goal:
        parts.append(f"Goal: {agent.goal}")
    if agent.instructions:
        parts.append(agent.instructions)
    return "\n\n".join(parts)


def _build_user_prompt(content: str, history: List[Message]) -> str:
    """Prepend the last N messages as conversation history."""
    if not history:
        return content
    lines = []
    for msg in history:
        role = "User" if msg.sender_type == "user" else "Assistant"
        lines.append(f"{role}: {msg.content}")
    context = "\n".join(lines)
    return f"Conversation so far:\n{context}\n\nUser: {content}"


async def _call_llm(agent: Agent, user_prompt: str) -> Tuple[str, Optional[dict]]:
    """
    Call the LLM and return (content, payload).
    payload stores token/cost metadata for the message record.
    Never raises — returns an error string on failure.
    """
    model = agent.model or _FALLBACK_MODEL
    system_prompt = _build_system_prompt(agent)
    try:
        response = await llm_complete(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        payload = {
            "model": model,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "cost": float(response.cost),
        }
        return response.content, payload
    except Exception as exc:
        return f"I encountered an error: {exc}", None


# ── Public API ────────────────────────────────────────────────────────────────

async def create_conversation(
    db: AsyncSession,
    body: ConversationCreate,
) -> Conversation:
    """
    Create a conversation.

    - If `agent_id` is provided, use that agent.
    - If only `prompt` is provided, match the best agent via keyword scoring.
    - If `prompt` is also provided, send it as the first message (LLM call).
    """
    # Resolve agent
    if body.agent_id:
        agent = await _get_agent(db, body.agent_id)
    elif body.prompt:
        agents = await _list_agents_for_org(db, body.organization_id)
        if not agents:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No agents found for this organization. Create an agent first.",
            )
        agent, intent, reason = route_agent(agents, body.prompt)
        log_routing(body.prompt, agent, intent, reason)
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No active agents found for this organization.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either agent_id or prompt.",
        )

    title = (body.title or (body.prompt or "New Conversation")[:80]).strip() or "New Conversation"

    conv = Conversation(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        user_id=body.user_id,
        agent_id=agent.id,
        context_type="agent",
        context_id=agent.id,
        title=title,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    # Send first message if prompt given
    if body.prompt:
        await _append_message_pair(
            db,
            conv=conv,
            agent=agent,
            user_id=body.user_id,
            content=body.prompt,
            prior_messages=[],
        )
        # Reload with messages
        await db.refresh(conv)
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv.id)
        )
        conv = result.scalar_one()

    return conv


async def send_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    content: str,
    user_id: Optional[uuid.UUID] = None,
) -> List[Message]:
    """
    Append a user message and a synchronous LLM reply to the conversation.
    Returns [user_message, agent_message].
    """
    conv = await _get_conversation(db, conversation_id)
    if not conv.agent_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Conversation has no agent assigned.",
        )
    agent = await _get_agent(db, conv.agent_id)

    # Gather recent history (messages already committed)
    prior = list(conv.messages)[-_HISTORY_WINDOW:]

    return await _append_message_pair(
        db,
        conv=conv,
        agent=agent,
        user_id=user_id or conv.user_id,
        content=content,
        prior_messages=prior,
    )


async def _append_message_pair(
    db: AsyncSession,
    *,
    conv: Conversation,
    agent: Agent,
    user_id: Optional[uuid.UUID],
    content: str,
    prior_messages: List[Message],
) -> List[Message]:
    # Placeholder user ID when no authenticated user available
    effective_user_id = user_id or uuid.UUID("00000000-0000-0000-0000-000000000001")

    user_msg = Message(
        id=uuid.uuid4(),
        organization_id=conv.organization_id,
        conversation_id=conv.id,
        sender_type="user",
        sender_id=effective_user_id,
        content=content,
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    user_prompt = _build_user_prompt(content, prior_messages)
    agent_content, payload = await _call_llm(agent, user_prompt)

    agent_msg = Message(
        id=uuid.uuid4(),
        organization_id=conv.organization_id,
        conversation_id=conv.id,
        sender_type="agent",
        sender_id=agent.id,
        content=agent_content,
        payload=payload,
    )
    db.add(agent_msg)
    await db.commit()
    await db.refresh(agent_msg)

    return [user_msg, agent_msg]


async def list_conversations(
    db: AsyncSession,
    organization_id: uuid.UUID,
    agent_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[Conversation]:
    q = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.organization_id == organization_id,
            Conversation.deleted_at.is_(None),
        )
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if agent_id:
        q = q.where(Conversation.agent_id == agent_id)
    if user_id:
        q = q.where(Conversation.user_id == user_id)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_conversation_with_messages(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conv


async def get_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    skip: int = 0,
    limit: int = 200,
) -> List[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())
