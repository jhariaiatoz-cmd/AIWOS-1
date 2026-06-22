import uuid
from typing import TYPE_CHECKING, List
from sqlalchemy import String, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization_member import OrganizationMember
    from app.models.organization_invitation import OrganizationInvitation
    from app.models.department import Department
    from app.models.agent import Agent
    from app.models.project import Project
    from app.models.task import Task
    from app.models.workflow import Workflow
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.models.knowledge_file import KnowledgeFile
    from app.models.knowledge_chunk import KnowledgeChunk
    from app.models.execution_log import ExecutionLog
    from app.models.agent_metric import AgentMetric
    from app.models.integration import Integration
    from app.models.task_execution import TaskExecution
    from app.models.provider_config import ProviderConfig


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    __table_args__ = (
        Index("idx_orgs_slug_unique", "slug", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    members: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    departments: Mapped[List["Department"]] = relationship(
        "Department",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    agents: Mapped[List["Agent"]] = relationship(
        "Agent",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    workflows: Mapped[List["Workflow"]] = relationship(
        "Workflow",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    knowledge_files: Mapped[List["KnowledgeFile"]] = relationship(
        "KnowledgeFile",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    knowledge_chunks: Mapped[List["KnowledgeChunk"]] = relationship(
        "KnowledgeChunk",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    execution_logs: Mapped[List["ExecutionLog"]] = relationship(
        "ExecutionLog",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    agent_metrics: Mapped[List["AgentMetric"]] = relationship(
        "AgentMetric",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    integrations: Mapped[List["Integration"]] = relationship(
        "Integration",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    task_executions: Mapped[List["TaskExecution"]] = relationship(
        "TaskExecution",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    provider_configs: Mapped[List["ProviderConfig"]] = relationship(
        "ProviderConfig",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
    invitations: Mapped[List["OrganizationInvitation"]] = relationship(
        "OrganizationInvitation",
        back_populates="organization",
        cascade="all, delete-orphan"
    )
