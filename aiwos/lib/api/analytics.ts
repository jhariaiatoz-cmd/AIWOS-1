import { apiClient } from "./client";

export type DashboardStats = {
  total_agents: number;
  running_tasks: number;
  tasks_completed: number;
  total_projects: number;
  active_projects: number;
  total_executions: number;
  workflow_count: number;
  total_cost_today: number;
  // Execution health breakdown
  executions_successful: number;
  executions_failed: number;
  executions_retried: number;
  executions_with_fallback: number;
};

export type DepartmentStat = {
  id: string;
  name: string;
  agent_count: number;
  completed_tasks: number;
  total_tasks: number;
};

export type ActivityItem = {
  id: string;
  agent_name: string | null;
  task_title: string | null;
  action: string;
  timestamp: string;
  status: string;
};

export type TopAgentStat = {
  id: string;
  name: string;
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
};

export type WeeklyCompletion = {
  date: string;
  completed: number;
};

export type DashboardResponse = {
  stats: DashboardStats;
  departments: DepartmentStat[];
  recent_activities: ActivityItem[];
  top_agents: TopAgentStat[];
  weekly_completions: WeeklyCompletion[];
};

export const analyticsApi = {
  dashboard: (organization_id: string) =>
    apiClient
      .get<DashboardResponse>("/analytics/dashboard", {
        params: { organization_id },
      })
      .then((r) => r.data),

  metrics: (organization_id: string, time_range: string) =>
    apiClient
      .get<AnalyticsMetricsResponse>("/analytics/metrics", {
        params: { organization_id, time_range },
      })
      .then((r) => r.data),

  executionMetrics: (organization_id: string) =>
    apiClient
      .get<ExecutionMetricsResponse>("/analytics/execution-metrics", {
        params: { organization_id },
      })
      .then((r) => r.data),
};

// ── Analytics Metrics types ───────────────────────────────────────────────────

export type TrendDataPoint = {
  date: string;
  created: number;
  completed: number;
};

export type DepartmentTaskStat = {
  department: string;
  tasks: number;
  percentage: number;
};

// ── Execution Metrics ─────────────────────────────────────────────────────────

export type WorkflowExecutionMetrics = {
  total_executions: number;
  completed: number;
  failed: number;
  running: number;
  success_rate: number;
  avg_duration_seconds: number;
};

export type ProviderUsageStat = {
  provider: string;
  count: number;
  percentage: number;
};

export type AgentUtilizationStat = {
  agent_id: string;
  agent_name: string;
  total_executions: number;
  successful: number;
  failed: number;
  success_rate: number;
  avg_duration_ms: number;
};

export type ExecutionMetricsResponse = {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  retry_count: number;
  avg_duration_ms: number;
  success_rate: number;
  workflow_metrics: WorkflowExecutionMetrics;
  provider_usage: ProviderUsageStat[];
  agent_utilization: AgentUtilizationStat[];
};

export type AnalyticsMetricsResponse = {
  // Task metrics
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  failed_tasks: number;
  completion_rate: number;

  // Execution metrics
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  retried_executions: number;
  avg_response_time_seconds: number;
  success_rate: number;

  // Agent metrics
  total_agents: number;
  active_agents: number;

  // Workflow / project metrics
  total_workflows: number;
  total_projects: number;
  active_projects: number;
  completed_projects: number;

  // Period-over-period % changes
  tasks_change_pct: number;
  completed_change_pct: number;
  success_rate_change_pct: number;
  response_time_change_pct: number;

  // Chart data
  task_completion_trend: TrendDataPoint[];
  tasks_by_department: DepartmentTaskStat[];
};
