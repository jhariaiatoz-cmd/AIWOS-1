import uuid
from typing import TYPE_CHECKING, List, Any
from sqlalchemy import Boolean, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.department import Department
    from app.models.task import Task
    from app.models.project_agent import ProjectAgent
    from app.models.workflow_agent import WorkflowAgent
    from app.models.workflow_step import WorkflowStep
    from app.models.agent_metric import AgentMetric
    from app.models.execution_log import ExecutionLog
    from app.models.task_execution import TaskExecution


class Agent(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "agents"

    __table_args__ = (
        Index("idx_agents_org", "organization_id"),
        Index("idx_agents_dept", "department_id"),
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
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    memory_config: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    tools: Mapped[Any] = mapped_column(JSONB, default=list, nullable=False)
    permissions: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="Created",
        nullable=False
    )
    is_manager: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="agents"
    )
    department: Mapped["Department | None"] = relationship(
        "Department",
        back_populates="agents"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="assigned_agent"
    )
    project_assignments: Mapped[List["ProjectAgent"]] = relationship(
        "ProjectAgent",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    workflow_assignments: Mapped[List["WorkflowAgent"]] = relationship(
        "WorkflowAgent",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    workflow_steps: Mapped[List["WorkflowStep"]] = relationship(
        "WorkflowStep",
        back_populates="agent"
    )
    metrics: Mapped[List["AgentMetric"]] = relationship(
        "AgentMetric",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    execution_logs: Mapped[List["ExecutionLog"]] = relationship(
        "ExecutionLog",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    task_executions: Mapped[List["TaskExecution"]] = relationship(
        "TaskExecution",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
