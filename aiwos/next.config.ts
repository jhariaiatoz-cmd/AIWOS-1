import type { NextConfig } from "next";

// Server-side only — never exposed to the browser bundle.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  // Proxy all /api/v1/* requests to the FastAPI backend.
  // This runs server-side, so the browser never makes a cross-origin request
  // and CORS is not involved at all — eliminating localhost/IPv6 ambiguity.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
