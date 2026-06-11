import uuid
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.workflow import Workflow
    from app.models.agent import Agent


class WorkflowAgent(Base):
    __tablename__ = "workflow_agents"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        primary_key=True
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True
    )
    role_in_workflow: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Relationships
    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="agents"
    )
    agent: Mapped["Agent"] = relationship(
        "Agent",
        back_populates="workflow_assignments"
    )
