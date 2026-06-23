"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, Zap, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import type { Workflow } from "@/lib/data/workflows";
import { EmptyState } from "@/components/common/EmptyState";
import { workflowApi } from "@/lib/api/workflows";

interface WorkflowTableProps {
  workflows: Workflow[];
}

function StatusBadge({ status }: { status: "Active" | "Inactive" | "Paused" }) {
  let bgColor: string;
  let textColor: string;

  switch (status) {
    case "Active":
      bgColor = "rgba(16,185,129,0.12)";
      textColor = "var(--green)";
      break;
    case "Inactive":
      bgColor = "rgba(107,114,128,0.12)";
      textColor = "var(--muted-foreground)";
      break;
    case "Paused":
      bgColor = "rgba(245,158,11,0.12)";
      textColor = "var(--amber)";
      break;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: bgColor, color: textColor }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: textColor }} />
      {status}
    </span>
  );
}

// ── Workflow detail sheet ─────────────────────────────────────────────────────

type ExecResult = {
  status: string;
  current_step_order: number | null;
  completed_steps: unknown[] | null;
  failed_steps: unknown[] | null;
  error_message: string | null;
};

function WorkflowDetailSheet({
  workflow,
  onClose,
}: {
  workflow: Workflow;
  onClose: () => void;
}) {
  const [execResult, setExecResult] = useState<ExecResult | null>(null);
  const [execId, setExecId] = useState<string | null>(null);

  // Poll for execution status while running
  const { data: polledExec } = useQuery({
    queryKey: ["workflow-execution", workflow.id, execId],
    queryFn: () => workflowApi.getExecution(workflow.id, execId!),
    enabled: !!execId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "running" ? 3_000 : false;
    },
  });

  useEffect(() => {
    if (polledExec) {
      setExecResult({
        status: polledExec.status,
        current_step_order: polledExec.current_step_order,
        completed_steps: polledExec.completed_steps,
        failed_steps: polledExec.failed_steps,
        error_message: polledExec.error_message,
      });
    }
  }, [polledExec]);

  const executeMutation = useMutation({
    mutationFn: () => workflowApi.execute(workflow.id),
    onSuccess: (data) => {
      setExecId(data.id);
      setExecResult({
        status: data.status,
        current_step_order: data.current_step_order,
        completed_steps: data.completed_steps,
        failed_steps: data.failed_steps,
        error_message: data.error_message,
      });
    },
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5"
          style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
        >
          <div className="min-w-0">
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">Workflow</p>
            <h2 className="truncate text-base font-semibold text-foreground">{workflow.name}</h2>
            {workflow.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{workflow.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Meta */}
          <div className="flex items-center gap-3">
            <StatusBadge status={workflow.status} />
            <span className="text-xs text-muted-foreground">
              Last run:{" "}
              {new Date(workflow.lastExecution).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Agents / Steps */}
          {workflow.assignedAgents.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Steps</p>
              <div className="space-y-2">
                {workflow.assignedAgents.map((agent, i) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    style={{
                      borderColor: "var(--border-light)",
                      background: "var(--surface)",
                    }}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--purple), var(--cyan))" }}
                    >
                      {agent.initials}
                    </div>
                    <span className="min-w-0 truncate text-sm text-foreground">{agent.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execute result */}
          {execResult && (
            <div
              className={`rounded-xl border p-4 ${
                execResult.status === "completed"
                  ? "border-green-500/30 bg-green-500/10"
                  : execResult.status === "failed"
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-cyan-500/30 bg-cyan-500/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {execResult.status === "completed" ? (
                  <CheckCircle size={15} className="text-green-400 shrink-0" />
                ) : execResult.status === "failed" ? (
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                ) : (
                  <Loader2 size={15} className="text-cyan-400 animate-spin shrink-0" />
                )}
                <span className="text-sm font-semibold capitalize" style={{
                  color: execResult.status === "completed" ? "var(--green)"
                    : execResult.status === "failed" ? "var(--red)"
                    : "var(--cyan)"
                }}>
                  {execResult.status === "completed" ? "Workflow completed" : execResult.status === "failed" ? "Workflow failed" : "Running…"}
                </span>
              </div>
              {execResult.status === "running" && execResult.current_step_order != null && (
                <p className="text-xs text-cyan-300 mb-1">
                  Executing step {execResult.current_step_order + 1}
                  {workflow.assignedAgents.length > 0 ? ` of ${workflow.assignedAgents.length}` : ""}
                  {workflow.assignedAgents[execResult.current_step_order]
                    ? ` — ${workflow.assignedAgents[execResult.current_step_order].name}`
                    : ""}
                </p>
              )}
              {execResult.completed_steps && execResult.completed_steps.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {execResult.completed_steps.length} step{execResult.completed_steps.length !== 1 ? "s" : ""} completed
                </p>
              )}
              {execResult.failed_steps && execResult.failed_steps.length > 0 && (
                <p className="text-xs text-red-400 mt-1">
                  {execResult.failed_steps.length} step{execResult.failed_steps.length !== 1 ? "s" : ""} failed
                </p>
              )}
              {execResult.error_message && (
                <p className="mt-1 text-xs text-red-300">{execResult.error_message}</p>
              )}
            </div>
          )}

          {executeMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              Failed to execute workflow. Please try again.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t px-6 py-4"
          style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
        >
          <button
            type="button"
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--purple)" }}
          >
            {executeMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Zap size={15} />
            )}
            {executeMutation.isPending ? "Running workflow…" : "Execute Workflow"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function WorkflowTable({ workflows }: WorkflowTableProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  if (workflows.length === 0) {
    return (
      <EmptyState
        title="No workflows found"
        description="Try changing your search or filters."
      />
    );
  }

  return (
    <>
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
                  background: "var(--input-bg)",
                  borderBottomColor: "var(--border-light)",
                }}
                className="border-b"
              >
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Workflow Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Trigger Event
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Assigned Agents
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Last Executed
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Success Rate
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground">
                  {/* Open */}
                </th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr
                  key={workflow.id}
                  style={{ borderBottomColor: "var(--border-light)" }}
                  className="border-b cursor-pointer transition-colors hover:bg-[var(--accent)]"
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{workflow.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{workflow.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-muted-foreground">{workflow.triggerEvent}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {workflow.assignedAgents.slice(0, 2).map((agent) => (
                        <div
                          key={agent.id}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, var(--purple), var(--cyan))" }}
                          title={agent.name}
                        >
                          {agent.initials}
                        </div>
                      ))}
                      {workflow.assignedAgents.length > 2 && (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
                          title={`+${workflow.assignedAgents.length - 2} more`}
                        >
                          +{workflow.assignedAgents.length - 2}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={workflow.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-muted-foreground">
                      {new Date(workflow.lastExecution).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${workflow.successRate}%`,
                            background:
                              workflow.successRate >= 99
                                ? "var(--green)"
                                : workflow.successRate >= 95
                                  ? "var(--cyan)"
                                  : "var(--amber)",
                          }}
                        />
                      </div>
                      <span className="w-10 text-xs font-medium text-foreground">
                        {workflow.successRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={15} className="ml-auto text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorkflow && (
        <WorkflowDetailSheet
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </>
  );
}
