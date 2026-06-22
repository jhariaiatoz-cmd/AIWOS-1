import { apiClient } from "./client";

export type NotificationApiResponse = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  entity_id: string | null;
  entity_type: string | null;
  is_read: boolean;
  created_at: string;
};

export const notificationApi = {
  list: (organization_id: string, skip = 0, limit = 50) =>
    apiClient
      .get<NotificationApiResponse[]>("/notifications", {
        params: { organization_id, skip, limit },
      })
      .then((r) => r.data),

  markRead: (id: string) =>
    apiClient
      .patch<NotificationApiResponse>(`/notifications/${id}/read`)
      .then((r) => r.data),

  markAllRead: (organization_id: string) =>
    apiClient
      .post<{ marked_read: number }>("/notifications/read-all", null, {
        params: { organization_id },
      })
      .then((r) => r.data),
};
