"use client";

import { useMemo, useState } from "react";
import { tasksData } from "@/lib/data/tasks";
import { TaskSearchBar } from "@/components/tasks/TaskSearchBar";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskTable } from "@/components/tasks/TaskTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SummaryCard } from "@/components/common/SummaryCard";

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
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Tasks" value={stats.total} />
        <SummaryCard label="In Progress" value={stats.inProgress} tone="cyan" />
        <SummaryCard label="Completed" value={stats.completed} tone="green" />
        <SummaryCard label="High Priority" value={stats.highPriority} tone="red" />
      </div>

      {/* Controls */}
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
        <EmptyState title="No tasks found" description="Try changing your search or filters." />
      )}
    </div>
  );
}
