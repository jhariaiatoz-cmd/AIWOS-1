"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { workflowsData } from "@/lib/data/workflows";
import { workflowApi, type WorkflowApiResponse } from "@/lib/api/workflows";
import { analyticsApi } from "@/lib/api/analytics";
import { useAuthStore } from "@/lib/store/auth";
import { WorkflowSearchBar } from "@/components/workflows/WorkflowSearchBar";
import { WorkflowFilterBar } from "@/components/workflows/WorkflowFilterBar";
import { WorkflowTable } from "@/components/workflows/WorkflowTable";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CreateWorkflowDialog } from "@/components/workflows/CreateWorkflowDialog";
import type { Workflow } from "@/lib/data/workflows";

function mapWorkflowStatus(s: string): "Active" | "Inactive" | "Paused" {
  if (s === "Active") return "Active";
  if (s === "Paused") return "Paused";
  return "Inactive"; // Draft / Archived
}

function toDisplayWorkflow(w: WorkflowApiResponse): Workflow {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? "",
    triggerEvent: "Manual",
    assignedAgents: w.steps.slice(0, 3).map((s) => ({
      id: s.id,
      name: s.name,
      initials: s.name.slice(0, 2).toUpperCase(),
    })),
    status: mapWorkflowStatus(w.status),
    lastExecution: w.updated_at,
    executionCount: 0,
    successRate: 0,
  };
}

export default function WorkflowsPage() {
  const { user, currentOrgId } = useAuthStore();
  const isGuest = user?.isGuest ?? true;

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const {
    data: apiWorkflows,
    isPending,
    error,
  } = useQuery({
    queryKey: ["workflows", currentOrgId],
    queryFn: () => workflowApi.list(currentOrgId!),
    enabled: !isGuest && !!currentOrgId,
  });

  const { data: execMetrics } = useQuery({
    queryKey: ["execution-metrics", currentOrgId],
    queryFn: () => analyticsApi.executionMetrics(currentOrgId!),
    enabled: !isGuest && !!currentOrgId,
    staleTime: 30_000,
  });

  const rawWorkflows: Workflow[] = isGuest
    ? workflowsData
    : (apiWorkflows ?? []).map(toDisplayWorkflow);

  const filteredWorkflows = useMemo(
    () =>
      rawWorkflows.filter((workflow) => {
        const matchesSearch =
          workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          workflow.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          workflow.triggerEvent
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter
          ? workflow.status === statusFilter
          : true;
        return matchesSearch && matchesStatus;
      }),
    [rawWorkflows, searchQuery, statusFilter]
  );

  const totalWorkflows = rawWorkflows.length;
  const activeWorkflows = rawWorkflows.filter((w) => w.status === "Active").length;
  // Real execution metrics come from the analytics endpoint; fall back to 0 while loading.
  const avgSuccessRate = execMetrics
    ? Math.round(execMetrics.workflow_metrics.success_rate)
    : 0;
  const totalExecutions = execMetrics
    ? execMetrics.workflow_metrics.total_executions
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor automated workflows
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none"
          style={{ background: "var(--purple)", color: "white" }}
        >
          <Plus size={16} />
          Create Workflow
        </button>
      </div>

      {!isGuest && !currentOrgId && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No organisation found. Create one in Settings to manage workflows.
        </div>
      )}

      {!isGuest && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load workflows. Please try again.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Workflows" value={totalWorkflows} />
        <SummaryCard label="Active" value={activeWorkflows} tone="cyan" />
        <SummaryCard
          label="Avg Success Rate"
          value={`${avgSuccessRate}%`}
          tone="green"
        />
        <SummaryCard
          label="Total Executions"
          value={totalExecutions.toLocaleString()}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full min-w-0 sm:max-w-sm">
          <WorkflowSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search workflows..."
          />
        </div>
        <WorkflowFilterBar
          status={statusFilter}
          onStatusChange={setStatusFilter}
          onReset={() => {
            setSearchQuery("");
            setStatusFilter("");
          }}
        />
      </div>

      {isPending && !isGuest ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading workflows…
        </div>
      ) : (
        <WorkflowTable workflows={filteredWorkflows} />
      )}

      <CreateWorkflowDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
