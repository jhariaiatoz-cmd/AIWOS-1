import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User
    from app.models.task import Task
    from app.models.project_agent import ProjectAgent
    from app.models.agent import Agent


class Project(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    __table_args__ = (
        Index("idx_projects_org", "organization_id"),
        Index("idx_projects_owner_agent", "owner_agent_id"),
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
    status: Mapped[str] = mapped_column(
        String(50),
        default="Planning",
        nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    owner_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True
    )
    blueprint: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="projects"
    )
    creator: Mapped["User | None"] = relationship(
        "User",
        back_populates="created_projects"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    agents: Mapped[List["ProjectAgent"]] = relationship(
        "ProjectAgent",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    owner_agent: Mapped["Agent | None"] = relationship(
        "Agent",
        foreign_keys="[Project.owner_agent_id]",
        back_populates="owned_projects",
    )
