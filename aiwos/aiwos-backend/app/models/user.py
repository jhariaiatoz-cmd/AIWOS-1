import uuid
from typing import TYPE_CHECKING, List
from sqlalchemy import String, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization_member import OrganizationMember
    from app.models.project import Project
    from app.models.knowledge_file import KnowledgeFile


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    __table_args__ = (
        Index("idx_users_email_unique", "email", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )

    # In Supabase, this references auth.users.id
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    memberships: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    created_projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="creator"
    )
    uploaded_files: Mapped[List["KnowledgeFile"]] = relationship(
        "KnowledgeFile",
        back_populates="uploader"
    )
