"""
AgentCommunicationService — agent-to-agent context exchange during task execution.

Allows one agent to request a short expert response from another agent before
its own LLM call. Results are injected into the requesting agent's prompt.

Limits:
  - Max 3 requests per execution (_MAX_REQUESTS)
  - Max 1000 chars per response (_MAX_RESPONSE_CHARS)
  - Max 2000 chars total injected context (_CONTEXT_CAP)
  - LLM call timeout: 30s (_COMM_LLM_TIMEOUT)
  - Communication failure is always non-fatal; execution continues normally
"""

import asyncio
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_message import AgentMessage
from app.models.project_agent import ProjectAgent
from app.models.task import Task

logger = logging.getLogger(__name__)

_MAX_REQUESTS = 3
_MAX_RESPONSE_CHARS = 1_000
_CONTEXT_CAP = 2_000
_COMM_LLM_TIMEOUT = 30
_DEFAULT_MODEL = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def send_message(
    db: AsyncSession,
    *,
    sender_agent_id: uuid.UUID,
    receiver_agent_id: uuid.UUID,
    task_id: uuid.UUID,
    organization_id: uuid.UUID,
    message: str,
    response: Optional[str],
    workflow_id: Optional[uuid.UUID] = None,
) -> Optional[AgentMessage]:
    """Persist an agent-to-agent message exchange. Returns None if table is unavailable."""
    record = AgentMessage(
        id=uuid.uuid4(),
        organization_id=organization_id,
        sender_agent_id=sender_agent_id,
        receiver_agent_id=receiver_agent_id,
        task_id=task_id,
        workflow_id=workflow_id,
        message=message,
        response=response,
    )
    db.add(record)
    try:
        await db.commit()
        return record
    except (ProgrammingError, OperationalError) as exc:
        await db.rollback()
        logger.warning("agent_messages table unavailable; message not saved: %s", exc)
        return None


async def get_recent_messages(
    db: AsyncSession,
    *,
    task_id: uuid.UUID,
    organization_id: uuid.UUID,
    limit: int = 10,
) -> list[AgentMessage]:
    """Return recent agent messages for a given task, newest-last."""
    try:
        result = await db.execute(
            select(AgentMessage)
            .where(
                AgentMessage.task_id == task_id,
                AgentMessage.organization_id == organization_id,
            )
            .order_by(AgentMessage.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())
    except (ProgrammingError, OperationalError) as exc:
        logger.warning("Could not load agent messages: %s", exc)
        return []


async def request_agent_input(
    db: AsyncSession,
    *,
    sender_agent_id: uuid.UUID,
    receiver_agent: Agent,
    task_id: uuid.UUID,
    organization_id: uuid.UUID,
    question: str,
    workflow_id: Optional[uuid.UUID] = None,
) -> Optional[str]:
    """
    Ask receiver_agent to answer question via a lightweight LLM call.

    Persists the exchange regardless of LLM outcome.
    Returns the response string (capped at _MAX_RESPONSE_CHARS), or None on failure.
    """
    # Deferred imports to avoid circular dependency with execution engine
    from app.services.conversation_service import _build_system_prompt
    from app.services.llm_provider_service import complete as llm_complete

    response: Optional[str] = None
    try:
        system_prompt = _build_system_prompt(receiver_agent)
        llm_resp = await asyncio.wait_for(
            llm_complete(
                model=receiver_agent.model or _DEFAULT_MODEL,
                system_prompt=system_prompt,
                user_prompt=question,
            ),
            timeout=_COMM_LLM_TIMEOUT,
        )
        response = llm_resp.content[:_MAX_RESPONSE_CHARS]
        logger.debug(
            "Agent comm: receiver=%s responded (%d chars)",
            receiver_agent.id, len(response),
        )
    except asyncio.TimeoutError:
        logger.warning(
            "Agent comm: LLM call for receiver=%s timed out after %ds",
            receiver_agent.id, _COMM_LLM_TIMEOUT,
        )
    except Exception as exc:
        logger.warning(
            "Agent comm: LLM call failed for receiver=%s: %s",
            receiver_agent.id, exc,
        )

    await send_message(
        db,
        sender_agent_id=sender_agent_id,
        receiver_agent_id=receiver_agent.id,
        task_id=task_id,
        organization_id=organization_id,
        message=question,
        response=response,
        workflow_id=workflow_id,
    )
    return response


async def gather_agent_context(
    db: AsyncSession,
    *,
    agent: Agent,
    task: Task,
    organization_id: uuid.UUID,
) -> str:
    """
    Find complementary project agents, request context from each (up to _MAX_REQUESTS),
    and return a formatted prompt section. Returns "" on any failure.
    """
    try:
        candidates = await _find_candidate_agents(db, agent=agent, task=task)
        if not candidates:
            return ""

        sections: list[str] = []
        total_chars = 0

        for candidate in candidates[:_MAX_REQUESTS]:
            if total_chars >= _CONTEXT_CAP:
                break

            question = _build_question(candidate, task)
            logger.info(
                "Agent comm: sender=%s (%s) → receiver=%s (%s) | task=%s",
                agent.id, agent.role, candidate.id, candidate.role, task.id,
            )

            response = await request_agent_input(
                db,
                sender_agent_id=agent.id,
                receiver_agent=candidate,
                task_id=task.id,
                organization_id=organization_id,
                question=question,
            )
            if not response:
                continue

            budget = _CONTEXT_CAP - total_chars
            snippet = response[:budget]
            sections.append(f"{candidate.name} ({candidate.role}):\n{snippet}")
            total_chars += len(snippet)

        if not sections:
            return ""

        return "## Agent Communications\n\n" + "\n\n".join(sections)

    except Exception as exc:
        logger.warning("gather_agent_context failed (non-fatal): %s", exc)
        return ""


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


async def _find_candidate_agents(
    db: AsyncSession,
    *,
    agent: Agent,
    task: Task,
) -> list[Agent]:
    """Return other agents assigned to the same project, excluding sender."""
    try:
        result = await db.execute(
            select(Agent)
            .join(ProjectAgent, ProjectAgent.agent_id == Agent.id)
            .where(
                ProjectAgent.project_id == task.project_id,
                Agent.id != agent.id,
                Agent.deleted_at.is_(None),
            )
            .limit(_MAX_REQUESTS)
        )
        return list(result.scalars().all())
    except Exception as exc:
        logger.warning("Could not load candidate agents: %s", exc)
        return []


def _build_question(receiver: Agent, task: Task) -> str:
    """Construct a focused question for the receiver agent based on its role and the task."""
    return (
        f"As a {receiver.role}, provide a concise expert summary (under 400 words) "
        f"of the key {receiver.role} considerations and requirements for the following task: "
        f'"{task.title}". '
        f"Focus strictly on your area of expertise. Be specific and actionable."
    )
