import { apiClient } from "./client";

export type SearchResultType = "agent" | "task" | "workflow" | "project";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
};

export const searchApi = {
  search: (organization_id: string, q: string, limit = 5) =>
    apiClient
      .get<SearchResponse>("/search", { params: { organization_id, q, limit } })
      .then((r) => r.data),
};
