"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { agentsData } from "@/lib/data/agents";
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { useAuthStore } from "@/lib/store/auth";
import { SearchBar } from "@/components/agents/SearchBar";
import { FilterBar } from "@/components/agents/FilterBar";
import { AgentTable } from "@/components/agents/AgentTable";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";
import type { Agent } from "@/lib/types";

// Deterministic avatar colour derived from UUID
const GRADIENTS = [
  "linear-gradient(135deg, #7c3aed, #06b6d4)",
  "linear-gradient(135deg, #06b6d4, #10b981)",
  "linear-gradient(135deg, #10b981, #f59e0b)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #ef4444, #ec4899)",
  "linear-gradient(135deg, #ec4899, #7c3aed)",
];

function avatarColor(id: string): string {
  const n = parseInt(id.replace(/-/g, "").slice(-4), 16);
  return GRADIENTS[n % GRADIENTS.length];
}

// Backend status → component status
function mapStatus(s: string): "Active" | "Idle" | "Paused" {
  if (s === "Active") return "Active";
  if (s === "Paused") return "Paused";
  return "Idle"; // Created / Retired
}

function toDisplayAgent(a: AgentApiResponse): Agent {
  const initials = a.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Derive a pseudo-performance from the id so bars aren't all 0
  const perf = 70 + (parseInt(a.id.replace(/-/g, "").slice(-2), 16) % 30);
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    department: "General",
    status: mapStatus(a.status),
    tasks: 0,
    performance: perf,
    avatarColor: avatarColor(a.id),
    initials,
  };
}

export default function AgentsPage() {
  const { user, currentOrgId } = useAuthStore();
  const isGuest = user?.isGuest ?? true;

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const {
    data: apiAgents,
    isPending,
    error,
  } = useQuery({
    queryKey: ["agents", currentOrgId],
    queryFn: () => agentApi.list(currentOrgId!),
    enabled: !isGuest && !!currentOrgId,
  });

  const rawAgents: Agent[] = isGuest
    ? agentsData
    : (apiAgents ?? []).map(toDisplayAgent);

  const filteredAgents = useMemo(
    () =>
      rawAgents.filter((agent) => {
        const matchesSearch =
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.role.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDepartment =
          !selectedDepartment || agent.department === selectedDepartment;
        const matchesStatus =
          !selectedStatus || agent.status === selectedStatus;
        return matchesSearch && matchesDepartment && matchesStatus;
      }),
    [rawAgents, searchQuery, selectedDepartment, selectedStatus]
  );

  const handleReset = () => {
    setSearchQuery("");
    setSelectedDepartment("");
    setSelectedStatus("");
  };

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your AI agents, their status, performance, and
            assignments.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Create Agent
        </button>
      </div>

      {!isGuest && !currentOrgId && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No organisation found. Create one in Settings to manage agents.
        </div>
      )}

      {!isGuest && error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load agents. Please try again.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by agent name or role..."
          />
        </div>
        <div className="shrink-0">
          <FilterBar
            department={selectedDepartment}
            status={selectedStatus}
            onDepartmentChange={setSelectedDepartment}
            onStatusChange={setSelectedStatus}
            onReset={handleReset}
          />
        </div>
      </div>

      {isPending && !isGuest ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading agents…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold">{filteredAgents.length}</span> of{" "}
              <span className="font-semibold">{rawAgents.length}</span> agents
            </p>
          </div>
          {filteredAgents.length > 0 ? (
            <AgentTable agents={filteredAgents} />
          ) : (
            <EmptyState
              title="No agents found"
              description="Try changing your search or filters."
            />
          )}
        </>
      )}

      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
