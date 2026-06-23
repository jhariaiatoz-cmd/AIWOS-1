"""
MemoryService — persistent per-agent memory across executions.

Stores short summaries of completed work and injects them into prompts
so agents recall what they have previously done on a project.
"""

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_memory import AgentMemory

logger = logging.getLogger(__name__)

_MEMORY_FETCH_LIMIT = 20
_MEMORY_CHAR_LIMIT = 2_000
_SUMMARY_SNIPPET_CHARS = 500


async def save_memory(
    db: AsyncSession,
    *,
    agent_id: uuid.UUID,
    organization_id: uuid.UUID,
    content: str,
    project_id: Optional[uuid.UUID] = None,
) -> Optional[AgentMemory]:
    """Persist a memory entry for an agent. Returns None if the table is unavailable."""
    memory = AgentMemory(
        id=uuid.uuid4(),
        organization_id=organization_id,
        agent_id=agent_id,
        project_id=project_id,
        content=content,
    )
    db.add(memory)
    try:
        await db.commit()
        return memory
    except (ProgrammingError, OperationalError) as exc:
        await db.rollback()
        logger.warning("agent_memories table unavailable; memory not saved: %s", exc)
        return None


async def load_recent_memories(
    db: AsyncSession,
    *,
    agent_id: uuid.UUID,
    project_id: Optional[uuid.UUID] = None,
    max_chars: int = _MEMORY_CHAR_LIMIT,
) -> str:
    """
    Load the most recent memories for an agent, optionally scoped to a project.

    Returns a formatted string ready to inject into a prompt, capped at max_chars.
    Memories are ordered newest-first; the returned string reflects that order so
    the agent sees the most relevant context first.
    """
    filters = [AgentMemory.agent_id == agent_id]
    if project_id is not None:
        filters.append(AgentMemory.project_id == project_id)

    try:
        result = await db.execute(
            select(AgentMemory)
            .where(*filters)
            .order_by(AgentMemory.created_at.desc())
            .limit(_MEMORY_FETCH_LIMIT)
        )
        memories = result.scalars().all()
    except (ProgrammingError, OperationalError) as exc:
        logger.warning("agent_memories table unavailable; continuing without memory context: %s", exc)
        return ""

    if not memories:
        return ""

    lines: list[str] = []
    total = 0
    for mem in memories:
        entry = f"- {mem.content}"
        if total + len(entry) > max_chars:
            remaining = max_chars - total
            if remaining > 20:
                lines.append(entry[:remaining])
            break
        lines.append(entry)
        total += len(entry)

    if not lines:
        return ""

    return "## Agent Memory\n\n" + "\n".join(lines)


def build_memory_content(task_title: str, task_phase: Optional[str], llm_output: str) -> str:
    """Build a compact memory string from a completed task execution."""
    phase_label = f" [{task_phase}]" if task_phase else ""
    snippet = llm_output.strip()[:_SUMMARY_SNIPPET_CHARS].replace("\n", " ")
    return f"Task{phase_label}: {task_title} — {snippet}"
