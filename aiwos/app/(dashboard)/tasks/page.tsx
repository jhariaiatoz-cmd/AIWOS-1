"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { tasksData } from "@/lib/data/tasks";
import { taskApi, type TaskApiResponse } from "@/lib/api/tasks";
import { projectApi } from "@/lib/api/projects";
import { useAuthStore } from "@/lib/store/auth";
import { TaskSearchBar } from "@/components/tasks/TaskSearchBar";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskTable } from "@/components/tasks/TaskTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import type { Task, TaskStatus, TaskPriority } from "@/lib/data/tasks";

function mapTaskStatus(s: string): TaskStatus {
  if (s === "In Progress") return "In Progress";
  if (s === "Review") return "In Review";
  if (s === "Done") return "Done";
  return "Todo"; // Todo / Cancelled / unknown
}

function mapPriority(s: string): TaskPriority {
  if (s === "High" || s === "Critical") return "High";
  if (s === "Low") return "Low";
  return "Medium";
}

function completionPct(status: string): number {
  if (status === "Done") return 100;
  if (status === "Review") return 75;
  if (status === "In Progress") return 50;
  return 0;
}

function toDisplayTask(t: TaskApiResponse): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: mapTaskStatus(t.status),
    priority: mapPriority(t.priority),
    assignedTo: t.assigned_to
      ? `Agent …${t.assigned_to.slice(-6)}`
      : "Unassigned",
    dueDate:
      t.due_date ??
      new Date(Date.now() + 7 * 86_400_000).toISOString(),
    completionPercentage: completionPct(t.status),
    tags: [],
  };
}

export default function TasksPage() {
  const { user, currentOrgId } = useAuthStore();
  const isGuest = user?.isGuest ?? true;

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");

  // Step 1 — fetch all projects so we know their IDs
  const { data: projects = [], isPending: projectsPending } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: !isGuest && !!currentOrgId,
  });

  // Step 2 — fetch tasks for every project in parallel
  const taskQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["tasks", p.id],
      queryFn: () => taskApi.list(p.id),
      enabled: !isGuest && !!p.id,
    })),
  });

  const apiTasks: Task[] = taskQueries
    .flatMap((q) => q.data ?? [])
    .map(toDisplayTask);

  const isLoadingTasks =
    !isGuest &&
    (projectsPending || taskQueries.some((q) => q.isPending && !q.data));

  const hasError =
    !isGuest && taskQueries.some((q) => q.error);

  const rawTasks: Task[] = isGuest ? tasksData : apiTasks;

  const filteredTasks = useMemo(
    () =>
      rawTasks.filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          !selectedStatus || task.status === selectedStatus;
        const matchesPriority =
          !selectedPriority || task.priority === selectedPriority;
        return matchesSearch && matchesStatus && matchesPriority;
      }),
    [rawTasks, searchQuery, selectedStatus, selectedPriority]
  );

  const handleReset = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedPriority("");
  };

  const stats = {
    total: rawTasks.length,
    completed: rawTasks.filter((t) => t.status === "Done").length,
    inProgress: rawTasks.filter((t) => t.status === "In Progress").length,
    highPriority: rawTasks.filter((t) => t.priority === "High").length,
  };

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            View, create, and manage tasks assigned to your AI agents.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Create Task
        </button>
      </div>

      {!isGuest && !currentOrgId && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No organisation found. Create one in Settings to manage tasks.
        </div>
      )}

      {hasError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load some tasks. Showing available data.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Tasks" value={stats.total} />
        <SummaryCard label="In Progress" value={stats.inProgress} tone="cyan" />
        <SummaryCard label="Completed" value={stats.completed} tone="green" />
        <SummaryCard
          label="High Priority"
          value={stats.highPriority}
          tone="red"
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <TaskSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by task title or description..."
          />
        </div>
        <div className="shrink-0">
          <TaskFilterBar
            status={selectedStatus}
            priority={selectedPriority}
            onStatusChange={setSelectedStatus}
            onPriorityChange={setSelectedPriority}
            onReset={handleReset}
          />
        </div>
      </div>

      {isLoadingTasks ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading tasks…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold">{filteredTasks.length}</span> of{" "}
              <span className="font-semibold">{rawTasks.length}</span> tasks
            </p>
          </div>
          {filteredTasks.length > 0 ? (
            <TaskTable tasks={filteredTasks} />
          ) : (
            <EmptyState
              title="No tasks found"
              description="Try changing your search or filters."
            />
          )}
        </>
      )}

      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
