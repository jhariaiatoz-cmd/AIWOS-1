import uuid
from sqlalchemy import ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AgentHandoff(Base, TimestampMixin):
    __tablename__ = "agent_handoffs"

    __table_args__ = (
        Index("idx_handoffs_wf_exec", "workflow_execution_id"),
        Index("idx_handoffs_source_agent", "source_agent_id"),
        Index("idx_handoffs_target_agent", "target_agent_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workflow_execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    # TaskExecution that produced the handoff content
    source_execution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    # TaskExecution that consumed the handoff content
    target_execution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Truncated output content passed from source → target agent
    handoff_content: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | injected | completed
    status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False)
    source_step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    target_step_order: Mapped[int] = mapped_column(Integer, nullable=False)
