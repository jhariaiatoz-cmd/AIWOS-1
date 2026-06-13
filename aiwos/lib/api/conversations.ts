import { apiClient } from "./client";

export type AgentSummary = {
  id: string;
  name: string;
  role: string;
  status: string;
  provider: string | null;
  model: string | null;
};

export type MessageResponse = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "agent";
  sender_id: string;
  content: string;
  payload: Record<string, unknown> | null;
  execution_id: string | null;
  created_at: string;
};

export type ConversationResponse = {
  id: string;
  organization_id: string;
  user_id: string | null;
  agent_id: string | null;
  title: string;
  context_type: string;
  context_id: string | null;
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
  agent: AgentSummary | null;
};

export type ConversationCreate = {
  organization_id: string;
  user_id?: string;
  agent_id?: string;
  title?: string;
  prompt?: string;
};

export const conversationApi = {
  create: (body: ConversationCreate) =>
    apiClient
      .post<ConversationResponse>("/conversations", body)
      .then((r) => r.data),

  list: (params: {
    organization_id: string;
    agent_id?: string;
    user_id?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get<ConversationResponse[]>("/conversations", { params })
      .then((r) => r.data),

  get: (conversation_id: string) =>
    apiClient
      .get<ConversationResponse>(`/conversations/${conversation_id}`)
      .then((r) => r.data),

  sendMessage: (conversation_id: string, content: string) =>
    apiClient
      .post<MessageResponse[]>(`/conversations/${conversation_id}/messages`, {
        content,
      })
      .then((r) => r.data),

  getMessages: (
    conversation_id: string,
    params?: { skip?: number; limit?: number }
  ) =>
    apiClient
      .get<MessageResponse[]>(
        `/conversations/${conversation_id}/messages`,
        { params }
      )
      .then((r) => r.data),
};
