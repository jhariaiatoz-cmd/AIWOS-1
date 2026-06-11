"use client";

import { FilterSelect } from "@/components/common/FilterSelect";
import { ResetFiltersButton } from "@/components/common/ResetFiltersButton";
import { taskStatuses, taskPriorities } from "@/lib/data/tasks";

interface TaskFilterBarProps {
  status: string;
  priority: string;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onReset: () => void;
}

export function TaskFilterBar({
  status,
  priority,
  onStatusChange,
  onPriorityChange,
  onReset,
}: TaskFilterBarProps) {
  const hasActiveFilters = status || priority;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <FilterSelect
        label="Filter tasks by status"
        value={status}
        onChange={onStatusChange}
        options={taskStatuses}
        allLabel="All Status"
      />
      <FilterSelect
        label="Filter tasks by priority"
        value={priority}
        onChange={onPriorityChange}
        options={taskPriorities}
        allLabel="All Priority"
      />
      {hasActiveFilters && <ResetFiltersButton onReset={onReset} />}
    </div>
  );
}
