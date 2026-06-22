import { apiClient } from "./client";

export type OrgApiResponse = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  timezone: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgMemberApiResponse = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  joined_at: string;
};

export type InvitationApiResponse = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type InvitationPublicApiResponse = {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
};

export type InvitationAcceptApiResponse = {
  access_token: string;
  token_type: string;
  organization_id: string;
};

export const orgApi = {
  list: (skip = 0, limit = 50) =>
    apiClient
      .get<OrgApiResponse[]>("/organizations", { params: { skip, limit } })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<OrgApiResponse>(`/organizations/${id}`).then((r) => r.data),

  create: (name: string, slug: string) =>
    apiClient
      .post<OrgApiResponse>("/organizations", { name, slug })
      .then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      industry: string;
      timezone: string;
      description: string;
    }>
  ) =>
    apiClient
      .patch<OrgApiResponse>(`/organizations/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/organizations/${id}`),

  getMembers: (id: string) =>
    apiClient
      .get<OrgMemberApiResponse[]>(`/organizations/${id}/members`)
      .then((r) => r.data),

  invite: (orgId: string, email: string, role: string) =>
    apiClient
      .post<InvitationApiResponse>(`/organizations/${orgId}/invite`, { email, role })
      .then((r) => r.data),
};

export const invitationApi = {
  get: (token: string) =>
    apiClient
      .get<InvitationPublicApiResponse>(`/invitations/${token}`)
      .then((r) => r.data),

  accept: (token: string, body: { full_name?: string; password?: string }) =>
    apiClient
      .post<InvitationAcceptApiResponse>(`/invitations/${token}/accept`, body)
      .then((r) => r.data),
};
