import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, literal_column, select
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
    AnalyticsMetricsResponse,
    DashboardResponse,
    DashboardStats,
    DepartmentStat,
    DepartmentTaskStat,
    TopAgentStat,
    TrendDataPoint,
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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round((current - previous) / previous * 100, 1)


def _day_label(d: date) -> str:
    return d.strftime("%b") + " " + str(d.day)


def _month_label(d: date) -> str:
    return d.strftime("%b %Y")


def _month_start_ago(today: date, months: int) -> date:
    year = today.year
    month = today.month - months
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


# ── Analytics Metrics endpoint ─────────────────────────────────────────────────

@router.get("/metrics", response_model=AnalyticsMetricsResponse)
async def analytics_metrics(
    organization_id: uuid.UUID,
    time_range: str = "7d",
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AnalyticsMetricsResponse:
    now = datetime.now(timezone.utc)
    today = now.date()
    current_period_start = now - timedelta(days=7)
    previous_period_start = now - timedelta(days=14)

    # ── Task counts ───────────────────────────────────────────────────────────
    total_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.deleted_at.is_(None),
        )
    ) or 0

    completed_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Done",
            Task.deleted_at.is_(None),
        )
    ) or 0

    in_progress_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status.in_(["In Progress", "In Review"]),
            Task.deleted_at.is_(None),
        )
    ) or 0

    pending_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Todo",
            Task.deleted_at.is_(None),
        )
    ) or 0

    failed_tasks = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Failed",
            Task.deleted_at.is_(None),
        )
    ) or 0

    completion_rate = round(
        (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0, 1
    )

    # ── Execution counts ──────────────────────────────────────────────────────
    total_executions = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    successful_executions = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    failed_executions = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "failed",
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    retried_executions = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.retry_count > 0,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    success_rate = round(
        (successful_executions / total_executions * 100)
        if total_executions > 0
        else 0.0,
        1,
    )

    # Average response time from the pre-computed execution_time_ms column
    avg_time_ms = await db.scalar(
        select(func.avg(TaskExecution.execution_time_ms)).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.execution_time_ms.is_not(None),
            TaskExecution.deleted_at.is_(None),
        )
    )
    avg_response_time_seconds = (
        round(float(avg_time_ms) / 1000.0, 2) if avg_time_ms else 0.0
    )

    # ── Agent counts ──────────────────────────────────────────────────────────
    total_agents = await db.scalar(
        select(func.count()).where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
        )
    ) or 0

    active_agent_subq = (
        select(TaskExecution.agent_id)
        .where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.created_at >= current_period_start,
            TaskExecution.agent_id.is_not(None),
            TaskExecution.deleted_at.is_(None),
        )
        .distinct()
        .subquery()
    )
    active_agents = await db.scalar(
        select(func.count()).select_from(active_agent_subq)
    ) or 0

    # ── Workflow / project counts ─────────────────────────────────────────────
    total_workflows = await db.scalar(
        select(func.count()).where(
            Workflow.organization_id == organization_id,
            Workflow.deleted_at.is_(None),
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

    completed_projects = await db.scalar(
        select(func.count()).where(
            Project.organization_id == organization_id,
            Project.status.in_(["completed", "Completed"]),
            Project.deleted_at.is_(None),
        )
    ) or 0

    # ── Period-over-period % changes (current 7 days vs previous 7 days) ─────
    tasks_current = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.created_at >= current_period_start,
            Task.deleted_at.is_(None),
        )
    ) or 0
    tasks_previous = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.created_at >= previous_period_start,
            Task.created_at < current_period_start,
            Task.deleted_at.is_(None),
        )
    ) or 0
    tasks_change_pct = _safe_pct_change(tasks_current, tasks_previous)

    completed_current = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Done",
            Task.updated_at >= current_period_start,
            Task.deleted_at.is_(None),
        )
    ) or 0
    completed_previous = await db.scalar(
        select(func.count()).where(
            Task.organization_id == organization_id,
            Task.status == "Done",
            Task.updated_at >= previous_period_start,
            Task.updated_at < current_period_start,
            Task.deleted_at.is_(None),
        )
    ) or 0
    completed_change_pct = _safe_pct_change(completed_current, completed_previous)

    exec_curr_total = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.created_at >= current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0
    exec_curr_success = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.created_at >= current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0
    exec_prev_total = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.created_at >= previous_period_start,
            TaskExecution.created_at < current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0
    exec_prev_success = await db.scalar(
        select(func.count()).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.created_at >= previous_period_start,
            TaskExecution.created_at < current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    ) or 0

    curr_sr = (exec_curr_success / exec_curr_total * 100) if exec_curr_total > 0 else 0.0
    prev_sr = (exec_prev_success / exec_prev_total * 100) if exec_prev_total > 0 else 0.0
    success_rate_change_pct = _safe_pct_change(curr_sr, prev_sr)

    avg_ms_curr = await db.scalar(
        select(func.avg(TaskExecution.execution_time_ms)).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.execution_time_ms.is_not(None),
            TaskExecution.created_at >= current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    )
    avg_ms_prev = await db.scalar(
        select(func.avg(TaskExecution.execution_time_ms)).where(
            TaskExecution.organization_id == organization_id,
            TaskExecution.status == "completed",
            TaskExecution.execution_time_ms.is_not(None),
            TaskExecution.created_at >= previous_period_start,
            TaskExecution.created_at < current_period_start,
            TaskExecution.deleted_at.is_(None),
        )
    )
    # Negative means response time improved (went down)
    response_time_change_pct = _safe_pct_change(
        float(avg_ms_curr or 0), float(avg_ms_prev or 0)
    )

    # ── Task completion trend ─────────────────────────────────────────────────
    if time_range == "7d":
        days_back = 7
        start_dt = now - timedelta(days=days_back)

        created_rows = await db.execute(
            select(
                func.date(Task.created_at).label("day"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.created_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date(Task.created_at))
        )
        created_map: dict[date, int] = {r.day: int(r.cnt) for r in created_rows.all()}

        done_rows = await db.execute(
            select(
                func.date(Task.updated_at).label("day"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.status == "Done",
                Task.updated_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date(Task.updated_at))
        )
        done_map: dict[date, int] = {r.day: int(r.cnt) for r in done_rows.all()}

        task_completion_trend = [
            TrendDataPoint(
                date=_day_label(today - timedelta(days=i)),
                created=created_map.get(today - timedelta(days=i), 0),
                completed=done_map.get(today - timedelta(days=i), 0),
            )
            for i in range(days_back - 1, -1, -1)
        ]

    elif time_range == "30d":
        start_dt = now - timedelta(days=30)

        created_rows = await db.execute(
            select(
                func.date(Task.created_at).label("day"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.created_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date(Task.created_at))
        )
        created_map = {r.day: int(r.cnt) for r in created_rows.all()}

        done_rows = await db.execute(
            select(
                func.date(Task.updated_at).label("day"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.status == "Done",
                Task.updated_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date(Task.updated_at))
        )
        done_map = {r.day: int(r.cnt) for r in done_rows.all()}

        # Produce one point per week (5 weeks)
        task_completion_trend = []
        for w in range(4, -1, -1):
            week_end = today - timedelta(weeks=w)
            week_start = week_end - timedelta(days=6)
            label = _day_label(week_start)
            task_completion_trend.append(TrendDataPoint(
                date=label,
                created=sum(
                    created_map.get(week_start + timedelta(days=j), 0)
                    for j in range(7)
                ),
                completed=sum(
                    done_map.get(week_start + timedelta(days=j), 0)
                    for j in range(7)
                ),
            ))

    elif time_range == "90d":
        start_dt = now - timedelta(days=91)
        _week = literal_column("'week'")

        created_rows = await db.execute(
            select(
                func.date_trunc(_week, Task.created_at).label("period"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.created_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date_trunc(_week, Task.created_at))
        )
        created_map = {r.period.date(): int(r.cnt) for r in created_rows.all()}

        done_rows = await db.execute(
            select(
                func.date_trunc(_week, Task.updated_at).label("period"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.status == "Done",
                Task.updated_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date_trunc(_week, Task.updated_at))
        )
        done_map = {r.period.date(): int(r.cnt) for r in done_rows.all()}

        task_completion_trend = []
        for w in range(12, -1, -1):
            week_end = today - timedelta(weeks=w)
            week_start = week_end - timedelta(days=week_end.weekday())
            label = _day_label(week_start)
            task_completion_trend.append(TrendDataPoint(
                date=label,
                created=created_map.get(week_start, 0),
                completed=done_map.get(week_start, 0),
            ))

    else:  # 1y
        start_dt = now - timedelta(days=366)
        _month = literal_column("'month'")

        created_rows = await db.execute(
            select(
                func.date_trunc(_month, Task.created_at).label("period"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.created_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date_trunc(_month, Task.created_at))
        )
        created_map = {r.period.date(): int(r.cnt) for r in created_rows.all()}

        done_rows = await db.execute(
            select(
                func.date_trunc(_month, Task.updated_at).label("period"),
                func.count().label("cnt"),
            )
            .where(
                Task.organization_id == organization_id,
                Task.status == "Done",
                Task.updated_at >= start_dt,
                Task.deleted_at.is_(None),
            )
            .group_by(func.date_trunc(_month, Task.updated_at))
        )
        done_map = {r.period.date(): int(r.cnt) for r in done_rows.all()}

        task_completion_trend = []
        for m in range(11, -1, -1):
            month_start = _month_start_ago(today, m)
            label = _month_label(month_start)
            task_completion_trend.append(TrendDataPoint(
                date=label,
                created=created_map.get(month_start, 0),
                completed=done_map.get(month_start, 0),
            ))

    # ── Tasks by department ───────────────────────────────────────────────────
    # Use literal_column for the fallback string so SELECT and GROUP BY produce
    # the same SQL expression (same parameter slot); a bind param causes a
    # PostgreSQL GroupingError because $1 in SELECT != $3 in GROUP BY.
    _unassigned = literal_column("'Unassigned'")
    dept_name_expr = func.coalesce(Department.name, _unassigned)
    dept_rows = await db.execute(
        select(
            dept_name_expr.label("dept_name"),
            func.count(Task.id).label("task_count"),
        )
        .select_from(Task)
        .outerjoin(Agent, Task.assigned_to == Agent.id)
        .outerjoin(Department, Agent.department_id == Department.id)
        .where(
            Task.organization_id == organization_id,
            Task.deleted_at.is_(None),
        )
        .group_by(dept_name_expr)
        .order_by(func.count(Task.id).desc())
    )
    dept_task_rows = dept_rows.all()

    dept_total = sum(r.task_count for r in dept_task_rows) or 1
    tasks_by_department = [
        DepartmentTaskStat(
            department=r.dept_name,
            tasks=int(r.task_count),
            percentage=round(r.task_count / dept_total * 100, 1),
        )
        for r in dept_task_rows
        if r.task_count > 0
    ]

    return AnalyticsMetricsResponse(
        total_tasks=int(total_tasks),
        completed_tasks=int(completed_tasks),
        in_progress_tasks=int(in_progress_tasks),
        pending_tasks=int(pending_tasks),
        failed_tasks=int(failed_tasks),
        completion_rate=completion_rate,
        total_executions=int(total_executions),
        successful_executions=int(successful_executions),
        failed_executions=int(failed_executions),
        retried_executions=int(retried_executions),
        avg_response_time_seconds=avg_response_time_seconds,
        success_rate=success_rate,
        total_agents=int(total_agents),
        active_agents=int(active_agents),
        total_workflows=int(total_workflows),
        total_projects=int(total_projects),
        active_projects=int(active_projects),
        completed_projects=int(completed_projects),
        tasks_change_pct=tasks_change_pct,
        completed_change_pct=completed_change_pct,
        success_rate_change_pct=success_rate_change_pct,
        response_time_change_pct=response_time_change_pct,
        task_completion_trend=task_completion_trend,
        tasks_by_department=tasks_by_department,
    )
