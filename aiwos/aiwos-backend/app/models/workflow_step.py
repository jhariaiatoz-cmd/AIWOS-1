import uuid
from typing import TYPE_CHECKING, Any
from sqlalchemy import ForeignKey, Integer, String, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.workflow import Workflow
    from app.models.agent import Agent


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    __table_args__ = (
        Index("idx_wf_steps_workflow", "workflow_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True
    )
    config: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="steps"
    )
    agent: Mapped["Agent | None"] = relationship(
        "Agent",
        back_populates="workflow_steps"
    )
