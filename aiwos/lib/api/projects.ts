import { apiClient } from "./client";
import type { BlueprintData, PromptPackData } from "./command_center";

export type AgentInfo = {
  id: string;
  name: string;
  role: string;
};

export type ProjectBlueprint = BlueprintData & {
  prompt_pack?: PromptPackData;
};

export type ProjectApiResponse = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  created_by: string | null;
  owner_agent_id: string | null;
  owner_agent: AgentInfo | null;
  created_at: string;
  updated_at: string;
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  blueprint: ProjectBlueprint | null;
};

export const projectApi = {
  list: (organization_id: string, skip = 0, limit = 100) =>
    apiClient
      .get<ProjectApiResponse[]>("/projects", {
        params: { organization_id, skip, limit },
      })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ProjectApiResponse>(`/projects/${id}`)
      .then((r) => r.data),

  create: (data: {
    organization_id: string;
    name: string;
    description?: string;
    status?: string;
    owner_agent_id?: string | null;
  }) =>
    apiClient.post<ProjectApiResponse>("/projects", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{ name: string; description: string; status: string; owner_agent_id: string | null }>
  ) =>
    apiClient
      .patch<ProjectApiResponse>(`/projects/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/projects/${id}`),
};
