import { apiClient } from "./client";

export type AgentApiResponse = {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  role: string;
  goal: string;
  instructions: string;
  skills: string[];
  provider: string | null;
  model: string | null;
  memory_config: unknown;
  tools: unknown[];
  permissions: unknown;
  status: string;
  is_manager: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentCreatePayload = {
  organization_id: string;
  name: string;
  role: string;
  goal: string;
  instructions: string;
  skills?: string[];
  provider?: string | null;
  model?: string | null;
  department_id?: string;
  status?: string;
  is_manager?: boolean;
  tools?: unknown[];
};

export const agentApi = {
  list: (organization_id: string, skip = 0, limit = 100, status?: string) =>
    apiClient
      .get<AgentApiResponse[]>("/agents", {
        params: { organization_id, skip, limit, ...(status ? { status } : {}) },
      })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<AgentApiResponse>(`/agents/${id}`).then((r) => r.data),

  create: (data: AgentCreatePayload) =>
    apiClient.post<AgentApiResponse>("/agents", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      role: string;
      goal: string;
      instructions: string;
      skills: string[];
      provider: string | null;
      model: string | null;
      status: string;
      is_manager: boolean;
    }>
  ) =>
    apiClient
      .patch<AgentApiResponse>(`/agents/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/agents/${id}`),

  workload: (agent_id: string) =>
    apiClient
      .get<{ projects_owned: number; tasks_assigned: number }>(`/agents/${agent_id}/workload`)
      .then((r) => r.data),
};
