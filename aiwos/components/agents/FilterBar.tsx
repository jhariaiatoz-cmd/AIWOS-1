"use client";

import { X } from "lucide-react";
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
    <div className="flex items-center gap-3">
      {/* Department filter */}
      <select
        value={department}
        onChange={(e) => onDepartmentChange(e.target.value)}
        className="h-10 rounded-lg border px-3 text-sm outline-none transition-colors"
        style={{
          background: "var(--input-bg)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <option value="">All Departments</option>
        {departments.map((dept) => (
          <option key={dept} value={dept}>
            {dept}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-10 rounded-lg border px-3 text-sm outline-none transition-colors"
        style={{
          background: "var(--input-bg)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <option value="">All Status</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          <X size={14} />
          Reset
        </button>
      )}
    </div>
  );
}
