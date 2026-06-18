import axios from "axios";

// In production or dev, this is the relative /api/v1 path — Next.js rewrites
// it server-side to the FastAPI backend, so the browser never makes a
// cross-origin request and CORS is not a factor.
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

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

// On 401, clear auth state and redirect to /auth — but skip auth endpoints
// themselves (login/register legitimately return 401/409 as domain errors, not
// session-expiry signals).
const AUTH_PATHS = ["/auth/login", "/auth/register"];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !AUTH_PATHS.some((p) => error.config?.url?.includes(p))
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
