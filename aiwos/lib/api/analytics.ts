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
};
