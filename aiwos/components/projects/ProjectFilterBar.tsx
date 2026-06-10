"use client";

import { X } from "lucide-react";
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
    <div className="flex items-center gap-3">
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
        {projectStatuses.map((s) => (
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
