import uuid
from datetime import datetime
from pydantic import BaseModel


# ── Execution Metrics (new endpoint) ─────────────────────────────────────────

class WorkflowExecutionMetrics(BaseModel):
    total_executions: int
    completed: int
    failed: int
    running: int
    success_rate: float
    avg_duration_seconds: float


class ProviderUsageStat(BaseModel):
    provider: str
    count: int
    percentage: float


class AgentUtilizationStat(BaseModel):
    agent_id: str
    agent_name: str
    total_executions: int
    successful: int
    failed: int
    success_rate: float
    avg_duration_ms: float


class ExecutionMetricsResponse(BaseModel):
    total_executions: int
    successful_executions: int
    failed_executions: int
    retry_count: int
    avg_duration_ms: float
    success_rate: float
    workflow_metrics: WorkflowExecutionMetrics
    provider_usage: list[ProviderUsageStat]
    agent_utilization: list[AgentUtilizationStat]


# ── Analytics Metrics (dedicated analytics page) ──────────────────────────────

class TrendDataPoint(BaseModel):
    date: str
    created: int
    completed: int


class DepartmentTaskStat(BaseModel):
    department: str
    tasks: int
    percentage: float


class AnalyticsMetricsResponse(BaseModel):
    # Task metrics
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    pending_tasks: int
    failed_tasks: int
    completion_rate: float

    # Execution metrics
    total_executions: int
    successful_executions: int
    failed_executions: int
    retried_executions: int
    avg_response_time_seconds: float
    success_rate: float

    # Agent metrics
    total_agents: int
    active_agents: int

    # Workflow / project metrics
    total_workflows: int
    total_projects: int
    active_projects: int
    completed_projects: int

    # Period-over-period % changes (current 7 days vs previous 7 days)
    tasks_change_pct: float
    completed_change_pct: float
    success_rate_change_pct: float
    response_time_change_pct: float  # negative = response time improved

    # Chart data
    task_completion_trend: list[TrendDataPoint]
    tasks_by_department: list[DepartmentTaskStat]


# ── Dashboard (existing) ───────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_agents: int
    running_tasks: int
    tasks_completed: int
    total_projects: int
    active_projects: int
    total_executions: int
    workflow_count: int
    total_cost_today: float
    # Execution health breakdown
    executions_successful: int = 0
    executions_failed: int = 0
    executions_retried: int = 0
    executions_with_fallback: int = 0


class DepartmentStat(BaseModel):
    id: str
    name: str
    agent_count: int
    completed_tasks: int
    total_tasks: int


class ActivityItem(BaseModel):
    id: str
    agent_name: str | None
    task_title: str | None
    action: str
    timestamp: datetime
    status: str


class TopAgentStat(BaseModel):
    id: str
    name: str
    tasks_completed: int
    tasks_failed: int
    success_rate: float


class WeeklyCompletion(BaseModel):
    date: str
    completed: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    departments: list[DepartmentStat]
    recent_activities: list[ActivityItem]
    top_agents: list[TopAgentStat]
    weekly_completions: list[WeeklyCompletion]
