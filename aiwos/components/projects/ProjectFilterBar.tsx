"use client";

import { FilterSelect } from "@/components/common/FilterSelect";
import { ResetFiltersButton } from "@/components/common/ResetFiltersButton";
import { projectStatuses } from "@/lib/data/projects";

interface ProjectFilterBarProps {
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function ProjectFilterBar({
  status,
  onStatusChange,
  onReset,
}: ProjectFilterBarProps) {
  const hasActiveFilters = status;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <FilterSelect
        label="Filter projects by status"
        value={status}
        onChange={onStatusChange}
        options={projectStatuses}
        allLabel="All Status"
      />
      {hasActiveFilters && <ResetFiltersButton onReset={onReset} />}
    </div>
  );
}
