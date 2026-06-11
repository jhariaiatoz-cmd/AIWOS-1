import uuid
from typing import TYPE_CHECKING, List
from sqlalchemy import Boolean, ForeignKey, String, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.agent import Agent
    from app.models.knowledge_file import KnowledgeFile


class Department(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "departments"

    __table_args__ = (
        Index("idx_dept_org", "organization_id"),
        Index("idx_dept_name_unique", "organization_id", "name", unique=True, postgresql_where=text("deleted_at IS NULL")),
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
    is_custom: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="departments"
    )
    agents: Mapped[List["Agent"]] = relationship(
        "Agent",
        back_populates="department"
    )
    knowledge_files: Mapped[List["KnowledgeFile"]] = relationship(
        "KnowledgeFile",
        back_populates="department"
    )
