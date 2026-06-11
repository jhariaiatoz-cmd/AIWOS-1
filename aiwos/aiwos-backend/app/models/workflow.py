import uuid
from typing import TYPE_CHECKING, List, Any
from sqlalchemy import ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.workflow_step import WorkflowStep
    from app.models.workflow_agent import WorkflowAgent


class Workflow(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "workflows"

    __table_args__ = (
        Index("idx_workflows_org", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    graph_definition: Mapped[Any] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="Draft",
        nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="workflows"
    )
    steps: Mapped[List["WorkflowStep"]] = relationship(
        "WorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan"
    )
    agents: Mapped[List["WorkflowAgent"]] = relationship(
        "WorkflowAgent",
        back_populates="workflow",
        cascade="all, delete-orphan"
    )
