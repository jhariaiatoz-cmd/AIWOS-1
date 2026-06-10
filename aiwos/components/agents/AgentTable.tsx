"use client";

import { MoreVertical } from "lucide-react";
import type { Agent } from "@/lib/types";

interface AgentTableProps {
  agents: Agent[];
}

function StatusBadge({ status }: { status: "Active" | "Idle" | "Paused" }) {
  let bgColor: string;
  let textColor: string;

  switch (status) {
    case "Active":
      bgColor = "rgba(16,185,129,0.12)";
      textColor = "var(--green)";
      break;
    case "Idle":
      bgColor = "rgba(245,158,11,0.12)";
      textColor = "var(--amber)";
      break;
    case "Paused":
      bgColor = "rgba(239,68,68,0.12)";
      textColor = "var(--red)";
      break;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: bgColor,
        color: textColor,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: textColor }}
      />
      {status}
    </span>
  );
}

export function AgentTable({ agents }: AgentTableProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border-light)",
                background: "var(--surface)",
              }}
            >
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Agent Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Tasks
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Performance
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, idx) => (
              <tr
                key={agent.id}
                className="transition-colors hover:bg-[var(--accent)]"
                style={{
                  borderBottom:
                    idx < agents.length - 1
                      ? "1px solid var(--border-light)"
                      : "none",
                }}
              >
                {/* Agent Name */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: agent.avatarColor }}
                    >
                      {agent.initials}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {agent.name}
                    </span>
                  </div>
                </td>

                {/* Role */}
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {agent.role}
                  </span>
                </td>

                {/* Department */}
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {agent.department}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <StatusBadge status={agent.status} />
                </td>

                {/* Tasks */}
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-medium text-foreground">
                    {agent.tasks}
                  </span>
                </td>

                {/* Performance */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-32 overflow-hidden rounded-full"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${agent.performance}%`,
                          background: "var(--green)",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-foreground">
                      {agent.performance}%
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
                    aria-label="Actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
