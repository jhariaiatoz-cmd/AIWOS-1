import uuid
from datetime import datetime
from pydantic import BaseModel


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
