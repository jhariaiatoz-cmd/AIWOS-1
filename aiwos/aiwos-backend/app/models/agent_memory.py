import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.organization import Organization
    from app.models.project import Project
    from app.models.task import Task
    from app.models.task_execution import TaskExecution


class AgentMemory(Base):
    __tablename__ = "agent_memories"

    __table_args__ = (
        Index("idx_agent_memory_agent_created", "agent_id", "created_at"),
        Index("idx_agent_memory_agent_project", "agent_id", "project_id"),
        Index("idx_agent_memory_org", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    execution_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    memory_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default="task_output"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    organization: Mapped["Organization"] = relationship("Organization")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="memories")
    project: Mapped[Optional["Project"]] = relationship("Project")
    task: Mapped[Optional["Task"]] = relationship("Task")
    execution: Mapped[Optional["TaskExecution"]] = relationship("TaskExecution")
