import { apiClient } from "./client";

export type WorkflowStepApiResponse = {
  id: string;
  workflow_id: string;
  name: string;
  node_id: string;
  step_order: number;
  agent_id: string | null;
  config: unknown;
};

export type WorkflowApiResponse = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  graph_definition: unknown;
  status: string;
  steps: WorkflowStepApiResponse[];
  created_at: string;
  updated_at: string;
};

export type WorkflowExecutionApiResponse = {
  id: string;
  workflow_id: string;
  organization_id: string;
  status: string;
  current_step_order: number | null;
  completed_steps: unknown[] | null;
  failed_steps: unknown[] | null;
  step_outputs: Record<string, string> | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export const workflowApi = {
  list: (organization_id: string, skip = 0, limit = 100) =>
    apiClient
      .get<WorkflowApiResponse[]>("/workflows", {
        params: { organization_id, skip, limit },
      })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<WorkflowApiResponse>(`/workflows/${id}`)
      .then((r) => r.data),

  create: (data: {
    organization_id: string;
    name: string;
    description?: string;
    graph_definition: unknown;
    status?: string;
  }) =>
    apiClient
      .post<WorkflowApiResponse>("/workflows", data)
      .then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      status: string;
      graph_definition: unknown;
    }>
  ) =>
    apiClient
      .patch<WorkflowApiResponse>(`/workflows/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/workflows/${id}`),

  execute: (id: string) =>
    apiClient
      .post<WorkflowExecutionApiResponse>(`/workflows/${id}/execute`)
      .then((r) => r.data),

  getExecution: (workflowId: string, executionId: string) =>
    apiClient
      .get<WorkflowExecutionApiResponse>(
        `/workflows/${workflowId}/executions/${executionId}`
      )
      .then((r) => r.data),
};
