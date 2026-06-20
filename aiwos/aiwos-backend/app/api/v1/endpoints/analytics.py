import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent import Agent
from app.models.agent_metric import AgentMetric
from app.models.department import Department
from app.models.project import Project
from app.models.task import Task
from app.models.task_execution import TaskExecution
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.analytics import (
    ActivityItem,
    DashboardResponse,
    DashboardStats,
    DepartmentStat,
    TopAgentStat,
    WeeklyCompletion,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    organization_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardResponse:
    today = date.today()
    week_start = datetime.now(timezone.utc) - timedelta(days=6)

    # ── Stats ─────────────────────────────────────────────────────────────────
    total_agents = await db.scalar(
        select(func.count()).where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
        )
    ) or 0

    running_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status.in_(["In Progress", "In Review"]),
            Task.deleted_at.is_(None),
        )
    ) or 0

    tasks_completed = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Done",
            Task.deleted_at.is_(None),
        )
    ) or 0

    total_projects = await db.scalar(
        select(func.count()).where(
            Project.organization_id == organization_id,
            Project.deleted_at.is_(None),
        )
    ) or 0

    active_projects = await db.scalar(
        select(func.count()).where(
            Project.organization_id == organization_id,
            Project.status.in_(["active", "Active"]),
            Project.deleted_at.is_(None),
        )
    ) or 0

    total_executions = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    workflow_count = await db.scalar(
        select(func.count()).where(
            Workflow.organization_id == organization_id,
            Workflow.deleted_at.is_(None),
        )
    ) or 0

    cost_today = await db.scalar(
        select(func.coalesce(func.sum(TaskExecution.cost), 0)).where(
            TaskExecution.organization_id == organization_id,
            func.date(TaskExecution.created_at) == today,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0.0

    # ── Execution health breakdown ─────────────────────────────────────────────
    executions_successful = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    executions_failed = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "failed",
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    executions_retried = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.retry_count > 0,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    # Count executions where a fallback provider was recorded in output_data JSONB
    executions_with_fallback = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.output_data["fallback_provider"].astext.isnot(None),
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    stats = DashboardStats(
        total_agents=total_agents,
        running_tasks=running_tasks,
        tasks_completed=tasks_completed,
        total_projects=total_projects,
        active_projects=active_projects,
        total_executions=total_executions,
        workflow_count=workflow_count,
        total_cost_today=float(cost_today),
        executions_successful=int(executions_successful),
        executions_failed=int(executions_failed),
        executions_retried=int(executions_retried),
        executions_with_fallback=int(executions_with_fallback),
    )

    # ── Departments ───────────────────────────────────────────────────────────
    dept_result = await db.execute(
        select(Department).where(
            Department.organization_id == organization_id,
            Department.deleted_at.is_(None),
        )
    )
    departments_raw = list(dept_result.scalars().all())

    # Fall back to grouping agents by department name when no dept records exist
    dept_stats: list[DepartmentStat] = []
    if departments_raw:
        for dept in departments_raw:
            agent_count = await db.scalar(
                select(func.count()).where(
                    Agent.department_id == dept.id,
                    Agent.deleted_at.is_(None),
                )
            ) or 0

            agent_ids_result = await db.execute(
                select(Agent.id).where(
                    Agent.department_id == dept.id,
                    Agent.deleted_at.is_(None),
                )
            )
            agent_ids = [row[0] for row in agent_ids_result.all()]

            completed = 0
            total = 0
            if agent_ids:
                completed = await db.scalar(
                    select(func.count()).where(
                        Task.assigned_to.in_(agent_ids),
                        Task.status == "Done",
                        Task.deleted_at.is_(None),
                    )
                ) or 0
                total = await db.scalar(
                    select(func.count()).where(
                        Task.assigned_to.in_(agent_ids),
                        Task.deleted_at.is_(None),
                    )
                ) or 0

            dept_stats.append(DepartmentStat(
                id=str(dept.id),
                name=dept.name,
                agent_count=agent_count,
                completed_tasks=completed,
                total_tasks=total,
            ))
    else:
        # No departments created yet — aggregate agents by their role prefix
        # so the dashboard still shows useful groupings
        agent_result = await db.execute(
            select(Agent).where(
                Agent.organization_id == organization_id,
                Agent.deleted_at.is_(None),
            )
        )
        agents = list(agent_result.scalars().all())
        if agents:
            dept_stats.append(DepartmentStat(
                id="ungrouped",
                name="All Agents",
                agent_count=len(agents),
                completed_tasks=tasks_completed,
                total_tasks=total_projects,
            ))

    # ── Recent Activities ─────────────────────────────────────────────────────
    exec_result = await db.execute(
        select(TaskExecution, Task, Agent)
        .join(Task, TaskExecution.task_id == Task.id)
        .outerjoin(Agent, TaskExecution.agent_id == Agent.id)
        .where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.deleted_at.is_(None),
        )
        .order_by(TaskExecution.created_at.desc())
        .limit(20)
    )
    rows = exec_result.all()

    action_labels = {
        "completed": "completed task",
        "failed": "failed task",
        "running": "is running task",
        "pending": "queued task",
        "cancelled": "cancelled task",
    }

    recent_activities: list[ActivityItem] = []
    for execution, task, agent in rows:
        recent_activities.append(ActivityItem(
            id=str(execution.id),
            agent_name=agent.name if agent else None,
            task_title=task.title if task else None,
            action=action_labels.get(execution.status, execution.status),
            timestamp=execution.created_at,
            status=execution.status,
        ))

    # ── Top Agents ────────────────────────────────────────────────────────────
    # Prefer AgentMetric aggregates; fall back to raw execution counts
    metric_result = await db.execute(
        select(
            AgentMetric.agent_id,
            func.sum(AgentMetric.tasks_completed).label("total_completed"),
            func.sum(AgentMetric.tasks_failed).label("total_failed"),
        )
        .where(AgentMetric.organization_id == organization_id)
        .group_by(AgentMetric.agent_id)
        .order_by(func.sum(AgentMetric.tasks_completed).desc())
        .limit(5)
    )
    top_metric_rows = list(metric_result.all())

    top_agents: list[TopAgentStat] = []
    for row in top_metric_rows:
        agent_result = await db.execute(
            select(Agent).where(
                Agent.id == row.agent_id,
                Agent.deleted_at.is_(None),
            )
        )
        agent = agent_result.scalar_one_or_none()
        if agent is None:
            continue
        done = int(row.total_completed or 0)
        failed = int(row.total_failed or 0)
        total = done + failed
        success_rate = round((done / total * 100) if total > 0 else 0.0, 1)
        top_agents.append(TopAgentStat(
            id=str(agent.id),
            name=agent.name,
            tasks_completed=done,
            tasks_failed=failed,
            success_rate=success_rate,
        ))

    if not top_agents:
        exec_count_result = await db.execute(
            select(
                TaskExecution.agent_id,
                func.count().label("exec_count"),
            )
            .where(
                TaskExecution.organization_id == organization_id,
                TaskExecution.status == "completed",
                TaskExecution.agent_id.is_not(None),
                TaskExecution.deleted_at.is_(None),
            )
            .group_by(TaskExecution.agent_id)
            .order_by(func.count().desc())
            .limit(5)
        )
        for row in exec_count_result.all():
            agent_result = await db.execute(
                select(Agent).where(
                    Agent.id == row.agent_id,
                    Agent.deleted_at.is_(None),
                )
            )
            agent = agent_result.scalar_one_or_none()
            if agent:
                top_agents.append(TopAgentStat(
                    id=str(agent.id),
                    name=agent.name,
                    tasks_completed=int(row.exec_count),
                    tasks_failed=0,
                    success_rate=100.0,
                ))

    # ── Weekly Completions ─────────────────────────────────────────────────────
    weekly_result = await db.execute(
        select(
            func.date(Task.updated_at).label("day"),
            func.count().label("count"),
        )
        .where(
            Task.organization_id == organization_id,
            Task.status == "Done",
            Task.updated_at >= week_start,
            Task.deleted_at.is_(None),
        )
        .group_by(func.date(Task.updated_at))
    )
    completion_map: dict[date, int] = {
        row.day: int(row.count) for row in weekly_result.all()
    }

    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly_completions: list[WeeklyCompletion] = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        label = day_labels[d.weekday()]
        weekly_completions.append(WeeklyCompletion(
            date=label,
            completed=completion_map.get(d, 0),
        ))

    return DashboardResponse(
        stats=stats,
        departments=dept_stats,
        recent_activities=recent_activities,
        top_agents=top_agents,
        weekly_completions=weekly_completions,
    )
