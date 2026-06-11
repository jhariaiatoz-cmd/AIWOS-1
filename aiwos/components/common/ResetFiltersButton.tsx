"use client";

import { X } from "lucide-react";

interface ResetFiltersButtonProps {
  onReset: () => void;
}

export function ResetFiltersButton({ onReset }: ResetFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-card focus:ring-2 focus:ring-primary/25 focus:outline-none"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--muted-foreground)",
      }}
    >
      <X aria-hidden="true" size={14} />
      Reset
    </button>
  );
}
