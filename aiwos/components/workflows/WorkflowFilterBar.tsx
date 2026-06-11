"use client";

import { FilterSelect } from "@/components/common/FilterSelect";
import { ResetFiltersButton } from "@/components/common/ResetFiltersButton";
import { workflowStatuses } from "@/lib/data/workflows";

interface WorkflowFilterBarProps {
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function WorkflowFilterBar({
  status,
  onStatusChange,
  onReset,
}: WorkflowFilterBarProps) {
  const hasActiveFilters = status;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <FilterSelect
        label="Filter workflows by status"
        value={status}
        onChange={onStatusChange}
        options={workflowStatuses}
        allLabel="All Status"
      />
      {hasActiveFilters && <ResetFiltersButton onReset={onReset} />}
    </div>
  );
}
