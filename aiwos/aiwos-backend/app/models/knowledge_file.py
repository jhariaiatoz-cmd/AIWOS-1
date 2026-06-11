import uuid
from typing import TYPE_CHECKING, List
from sqlalchemy import BigInteger, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.department import Department
    from app.models.user import User
    from app.models.knowledge_chunk import KnowledgeChunk


class KnowledgeFile(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "knowledge_files"

    __table_args__ = (
        Index("idx_k_files_org", "organization_id"),
        Index("idx_k_files_dept", "department_id"),
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
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="knowledge_files"
    )
    department: Mapped["Department | None"] = relationship(
        "Department",
        back_populates="knowledge_files"
    )
    uploader: Mapped["User | None"] = relationship(
        "User",
        back_populates="uploaded_files"
    )
    chunks: Mapped[List["KnowledgeChunk"]] = relationship(
        "KnowledgeChunk",
        back_populates="knowledge_file",
        cascade="all, delete-orphan"
    )
