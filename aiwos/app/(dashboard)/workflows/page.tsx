"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { workflowsData } from "@/lib/data/workflows";
import { WorkflowSearchBar } from "@/components/workflows/WorkflowSearchBar";
import { WorkflowFilterBar } from "@/components/workflows/WorkflowFilterBar";
import { WorkflowTable } from "@/components/workflows/WorkflowTable";
import { SummaryCard } from "@/components/common/SummaryCard";

export default function WorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredWorkflows = useMemo(() => {
    return workflowsData.filter((workflow) => {
      const matchesSearch =
        workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.triggerEvent
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter ? workflow.status === statusFilter : true;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const totalWorkflows = workflowsData.length;
  const activeWorkflows = workflowsData.filter(
    (w) => w.status === "Active"
  ).length;
  const avgSuccessRate =
    Math.round(
      workflowsData.reduce((sum, w) => sum + w.successRate, 0) /
        workflowsData.length
    ) || 0;
  const totalExecutions = workflowsData.reduce(
    (sum, w) => sum + w.executionCount,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor automated workflows
          </p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none"
          style={{
            background: "var(--purple)",
            color: "white",
          }}
        >
          <Plus size={16} />
          Create Workflow
        </button>
      </div>

      {/* Quick stats */}
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

      {/* Search and filters */}
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

      {/* Table */}
      <WorkflowTable workflows={filteredWorkflows} />
    </div>
  );
}
