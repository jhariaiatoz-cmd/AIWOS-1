import axios from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from the dedicated token key set by the auth store.
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("aiwos-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On 401, clear auth state and redirect to /auth.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      // Lazy-import to avoid circular dependency at module load time.
      import("@/lib/store/auth").then(({ useAuthStore }) => {
        useAuthStore.getState().signOut();
        window.location.replace("/auth");
      });
    }
    return Promise.reject(error);
  }
);
