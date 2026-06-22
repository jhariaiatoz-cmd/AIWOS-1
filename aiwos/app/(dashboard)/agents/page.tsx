"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { agentsData } from "@/lib/data/agents";
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { useAuthStore } from "@/lib/store/auth";
import { SearchBar } from "@/components/agents/SearchBar";
import { FilterBar } from "@/components/agents/FilterBar";
import { AgentTable } from "@/components/agents/AgentTable";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";
import { EditAgentDialog } from "@/components/agents/EditAgentDialog";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { DeleteAllAgentsDialog } from "@/components/agents/DeleteAllAgentsDialog";
import type { Agent } from "@/lib/types";

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

function mapStatus(s: string): "Active" | "Idle" | "Paused" {
  if (s === "Active") return "Active";
  if (s === "Paused") return "Paused";
  return "Idle";
}

function toDisplayAgent(a: AgentApiResponse): Agent {
  const initials = a.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    provider: a.provider,
    model: a.model,
  };
}

export default function AgentsPage() {
  const { user, currentOrgId } = useAuthStore();
  const isGuest = user?.isGuest ?? true;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentApiResponse | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AgentApiResponse | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
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

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      agentApi.update(id, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] }),
  });

  const { mutate: duplicateAgent } = useMutation({
    mutationFn: (src: AgentApiResponse) =>
      agentApi.create({
        organization_id: src.organization_id,
        name: `${src.name} (Copy)`,
        role: src.role,
        goal: src.goal,
        instructions: src.instructions,
        skills: src.skills,
        provider: src.provider,
        model: src.model,
        status: "Created",
        is_manager: src.is_manager,
        tools: src.tools as unknown[],
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] }),
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

  const handleEdit = (agentId: string) => {
    const full = apiAgents?.find((a) => a.id === agentId);
    if (full) setEditingAgent(full);
  };

  const handleDelete = (agentId: string) => {
    const full = apiAgents?.find((a) => a.id === agentId);
    if (full) setDeletingAgent(full);
  };

  const handleDuplicate = (agentId: string) => {
    const full = apiAgents?.find((a) => a.id === agentId);
    if (full) duplicateAgent(full);
  };

  const handleActivate = (agentId: string) =>
    updateStatus({ id: agentId, status: "Active" });

  const handleDeactivate = (agentId: string) =>
    updateStatus({ id: agentId, status: "Paused" });

  const handleArchive = (agentId: string) =>
    updateStatus({ id: agentId, status: "Retired" });

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
        <div className="flex items-center gap-2 shrink-0">
          {!isGuest && rawAgents.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all hover:-translate-y-px"
              style={{
                borderColor: "rgba(239,68,68,0.4)",
                color: "var(--red, #ef4444)",
                background: "rgba(239,68,68,0.05)",
              }}
            >
              <Trash2 size={14} />
              Delete All
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--purple)" }}
          >
            <Plus size={16} />
            Create Agent
          </button>
        </div>
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
            <AgentTable
              agents={filteredAgents}
              onEdit={!isGuest ? handleEdit : undefined}
              onDuplicate={!isGuest ? handleDuplicate : undefined}
              onActivate={!isGuest ? handleActivate : undefined}
              onDeactivate={!isGuest ? handleDeactivate : undefined}
              onArchive={!isGuest ? handleArchive : undefined}
              onDelete={!isGuest ? handleDelete : undefined}
            />
          ) : (
            <EmptyState
              title="No agents found"
              description="Try changing your search or filters."
            />
          )}
        </>
      )}

      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditAgentDialog agent={editingAgent} onClose={() => setEditingAgent(null)} />
      <DeleteAgentDialog agent={deletingAgent} onClose={() => setDeletingAgent(null)} />
      <DeleteAllAgentsDialog
        open={deleteAllOpen}
        agentCount={rawAgents.length}
        onClose={() => setDeleteAllOpen(false)}
      />
    </div>
  );
}
