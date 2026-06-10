"use client";

import { useMemo, useState } from "react";
import { tasksData } from "@/lib/data/tasks";
import { TaskSearchBar } from "@/components/tasks/TaskSearchBar";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskTable } from "@/components/tasks/TaskTable";

export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");

  const filteredTasks = useMemo(() => {
    return tasksData.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !selectedStatus || task.status === selectedStatus;

      const matchesPriority =
        !selectedPriority || task.priority === selectedPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [searchQuery, selectedStatus, selectedPriority]);

  const handleReset = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedPriority("");
  };

  // Calculate statistics
  const stats = {
    total: tasksData.length,
    completed: tasksData.filter((t) => t.status === "Done").length,
    inProgress: tasksData.filter((t) => t.status === "In Progress").length,
    highPriority: tasksData.filter((t) => t.priority === "High").length,
  };

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          View, create, and manage tasks assigned to your AI agents.
        </p>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="text-xs text-muted-foreground">Total Tasks</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {stats.total}
          </div>
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="text-xs text-muted-foreground">In Progress</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: "var(--cyan)" }}>
            {stats.inProgress}
          </div>
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: "var(--green)" }}>
            {stats.completed}
          </div>
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="text-xs text-muted-foreground">High Priority</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: "var(--red)" }}>
            {stats.highPriority}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <TaskSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by task title or description..."
          />
        </div>
        <div className="flex shrink-0 gap-3">
          <TaskFilterBar
            status={selectedStatus}
            priority={selectedPriority}
            onStatusChange={setSelectedStatus}
            onPriorityChange={setSelectedPriority}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold">{filteredTasks.length}</span> of{" "}
          <span className="font-semibold">{tasksData.length}</span> tasks
        </p>
      </div>

      {/* Table */}
      {filteredTasks.length > 0 ? (
        <TaskTable tasks={filteredTasks} />
      ) : (
        <div
          className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <p className="text-sm text-muted-foreground">
            No tasks found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
}
