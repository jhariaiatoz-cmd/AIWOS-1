"""
MemoryService — persistent per-agent memory across executions.

Stores short summaries of completed work and injects them into prompts
so agents recall what they have previously done on a project.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_memory import AgentMemory

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
) -> AgentMemory:
    """Persist a memory entry for an agent."""
    memory = AgentMemory(
        id=uuid.uuid4(),
        organization_id=organization_id,
        agent_id=agent_id,
        project_id=project_id,
        content=content,
    )
    db.add(memory)
    await db.commit()
    return memory


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

    result = await db.execute(
        select(AgentMemory)
        .where(*filters)
        .order_by(AgentMemory.created_at.desc())
        .limit(_MEMORY_FETCH_LIMIT)
    )
    memories = result.scalars().all()

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
