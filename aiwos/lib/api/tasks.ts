import { apiClient } from "./client";

export type AssignedAgentInfo = {
  id: string;
  name: string;
  role: string;
};

export type TaskApiResponse = {
  id: string;
  organization_id: string;
  project_id: string;
  assigned_to: string | null;
  assigned_agent: AssignedAgentInfo | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  phase: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const taskApi = {
  list: (project_id: string, skip = 0, limit = 100) =>
    apiClient
      .get<TaskApiResponse[]>("/tasks", {
        params: { project_id, skip, limit },
      })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<TaskApiResponse>(`/tasks/${id}`).then((r) => r.data),

  create: (data: {
    organization_id: string;
    project_id: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    assigned_to?: string;
    due_date?: string;
  }) =>
    apiClient.post<TaskApiResponse>("/tasks", data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      priority: string;
      status: string;
      assigned_to: string;
      due_date: string;
      completed_at: string;
    }>
  ) =>
    apiClient
      .patch<TaskApiResponse>(`/tasks/${id}`, data)
      .then((r) => r.data),

  createFromProject: (data: {
    project_id: string;
    organization_id: string;
    milestones?: string[];
    tasks?: string[];
    phase_tasks?: { title: string; description?: string; phase?: string; suggested_role?: string }[];
    priority?: string;
    owner_agent_id?: string | null;
  }) =>
    apiClient
      .post<{ created: TaskApiResponse[]; count: number }>("/tasks/from-project", data)
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/tasks/${id}`),
};
