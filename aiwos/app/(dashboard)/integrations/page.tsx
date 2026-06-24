"use client";

import { Puzzle } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Third-party integrations are planned for a future AIWOS release.
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: "rgba(139,92,246,0.15)",
            color: "var(--purple)",
          }}
        >
          Coming Soon
        </span>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border py-20 text-center"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
        }}
      >
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "rgba(139,92,246,0.12)" }}
        >
          <Puzzle size={32} className="text-purple-400" />
        </div>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          Integrations Coming Soon
        </h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Future releases will support GitHub, Slack, Gmail, Jira, Google Drive,
          Salesforce, PostgreSQL, and additional enterprise integrations.
        </p>
      </div>
    </div>
  );
}
