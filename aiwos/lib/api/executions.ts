import { apiClient } from "./client";

export type ExecutionErrorType =
  | "quota_exceeded"
  | "rate_limited"
  | "service_unavailable"
  | "auth_error"
  | "unknown";

export type ExecutionApiResponse = {
  id: string;
  task_id: string;
  agent_id: string | null;
  organization_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  output_data: {
    content?: string;
    provider_used?: string | null;
    fallback_provider?: string | null;
    error_type?: ExecutionErrorType | null;
  } | null;
  error_message: string | null;
  token_count: number;
  cost: number;
  execution_time_ms: number | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  // Provider tracking fields surfaced as top-level by the backend schema
  provider_used?: string | null;
  fallback_provider?: string | null;
  error_type?: ExecutionErrorType | null;
};

export type ExecuteTaskApiResponse = {
  execution_id: string;
  status: string;
};

export const executionApi = {
  execute: (task_id: string, agent_id?: string) =>
    apiClient
      .post<ExecuteTaskApiResponse>(`/tasks/${task_id}/execute`, { agent_id })
      .then((r) => r.data),

  get: (execution_id: string) =>
    apiClient
      .get<ExecutionApiResponse>(`/executions/${execution_id}`)
      .then((r) => r.data),

  list: (params?: {
    task_id?: string;
    agent_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get<ExecutionApiResponse[]>("/executions", { params })
      .then((r) => r.data),
};
