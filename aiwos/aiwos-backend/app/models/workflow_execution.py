import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, SoftDeleteMixin


class WorkflowExecution(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "workflow_executions"

    __table_args__ = (
        Index("idx_wf_executions_workflow", "workflow_id"),
        Index("idx_wf_executions_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # overall status: pending | running | completed | failed
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    # step_order of the step currently executing (null when idle/done)
    current_step_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # list of {"node_id", "step_order", "name", "execution_id"} dicts
    completed_steps: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    # list of {"node_id", "step_order", "name", "execution_id", "error"} dicts
    failed_steps: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    # dict of node_id -> truncated output content string
    step_outputs: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
