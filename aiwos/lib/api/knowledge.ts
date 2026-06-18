import { apiClient } from "./client";

export type KnowledgeFileApiResponse = {
  id: string;
  organization_id: string;
  name: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

export const knowledgeApi = {
  list: (organization_id: string) =>
    apiClient
      .get<KnowledgeFileApiResponse[]>("/knowledge", {
        params: { organization_id },
      })
      .then((r) => r.data),

  upload: (organization_id: string, file: File) => {
    const form = new FormData();
    form.append("organization_id", organization_id);
    form.append("file", file);
    return apiClient
      .post<KnowledgeFileApiResponse>("/knowledge/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  delete: (id: string) => apiClient.delete(`/knowledge/${id}`),
};
