import { apiClient } from "./client";

export type CommandCenterAgentInfo = {
  id: string;
  name: string;
  role: string;
  phase: string;
};

export type BlueprintData = {
  requirements?: string;
  features?: string;
  user_roles?: string;
  architecture?: string;
  database_design?: string;
  api_modules?: string;
  deployment_strategy?: string;
};

export type PromptPackData = {
  frontend?: string;
  backend?: string;
  database?: string;
  testing?: string;
  deployment?: string;
};

export type CommandCenterResponse = {
  is_project_command: boolean;
  project_id: string | null;
  project_name: string | null;
  task_count: number;
  workflow_id: string | null;
  workflow_name: string | null;
  assigned_agents: CommandCenterAgentInfo[];
  duplicate: boolean;
  blueprint: BlueprintData | null;
  prompt_pack: PromptPackData | null;
};

export const commandCenterApi = {
  execute: (data: { organization_id: string; prompt: string }) =>
    apiClient
      .post<CommandCenterResponse>("/command-center/execute", data)
      .then((r) => r.data),
};
