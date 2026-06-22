"use client";

import { ActionMenu } from "@/components/common/ActionMenu";
import type { Agent } from "@/lib/types";

interface AgentTableProps {
  agents: Agent[];
  onEdit?: (agentId: string) => void;
  onDuplicate?: (agentId: string) => void;
  onActivate?: (agentId: string) => void;
  onDeactivate?: (agentId: string) => void;
  onArchive?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
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

const PROVIDER_META: Record<string, { label: string; bg: string; color: string }> = {
  openai:    { label: "OpenAI",     bg: "rgba(16,163,127,0.12)",  color: "#10a37f" },
  google:    { label: "Google",     bg: "rgba(66,133,244,0.12)",  color: "#4285f4" },
  gemini:    { label: "Gemini",     bg: "rgba(66,133,244,0.12)",  color: "#4285f4" },
  anthropic: { label: "Anthropic",  bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
};

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const meta = PROVIDER_META[provider.toLowerCase()];
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export function AgentTable({
  agents,
  onEdit,
  onDuplicate,
  onActivate,
  onDeactivate,
  onArchive,
  onDelete,
}: AgentTableProps) {
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
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Agent Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Role / Model
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Provider
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Department
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Tasks
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Performance
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
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

                {/* Role / Model */}
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">{agent.role}</span>
                    {agent.model && (
                      <span className="text-xs text-muted-foreground/60 font-mono">
                        {agent.model}
                      </span>
                    )}
                  </div>
                </td>

                {/* Provider */}
                <td className="px-6 py-4">
                  <ProviderBadge provider={agent.provider} />
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
                  <ActionMenu
                    label={`Actions for ${agent.name}`}
                    onEdit={onEdit ? () => onEdit(agent.id) : undefined}
                    onDuplicate={onDuplicate ? () => onDuplicate(agent.id) : undefined}
                    onActivate={agent.status !== "Active" && onActivate ? () => onActivate(agent.id) : undefined}
                    onDeactivate={agent.status === "Active" && onDeactivate ? () => onDeactivate(agent.id) : undefined}
                    onArchive={onArchive ? () => onArchive(agent.id) : undefined}
                    onDelete={onDelete ? () => onDelete(agent.id) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
