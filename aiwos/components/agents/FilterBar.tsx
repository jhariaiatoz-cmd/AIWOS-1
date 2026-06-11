"use client";

import { FilterSelect } from "@/components/common/FilterSelect";
import { ResetFiltersButton } from "@/components/common/ResetFiltersButton";
import { departments, statuses } from "@/lib/data/agents";

interface FiltersProps {
  department: string;
  status: string;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function FilterBar({
  department,
  status,
  onDepartmentChange,
  onStatusChange,
  onReset,
}: FiltersProps) {
  const hasActiveFilters = department || status;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <FilterSelect
        label="Filter agents by department"
        value={department}
        onChange={onDepartmentChange}
        options={departments}
        allLabel="All Departments"
      />
      <FilterSelect
        label="Filter agents by status"
        value={status}
        onChange={onStatusChange}
        options={statuses}
        allLabel="All Status"
      />
      {hasActiveFilters && <ResetFiltersButton onReset={onReset} />}
    </div>
  );
}
