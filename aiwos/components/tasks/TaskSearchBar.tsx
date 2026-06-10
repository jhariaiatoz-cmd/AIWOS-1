"use client";

import { Search } from "lucide-react";

interface TaskSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TaskSearchBar({
  value,
  onChange,
  placeholder = "Search tasks...",
}: TaskSearchBarProps) {
  return (
    <div className="relative flex items-center">
      <Search
        size={14}
        className="absolute left-3 pointer-events-none"
        style={{ color: "var(--faint)" }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border pl-10 pr-3 text-sm outline-none transition-colors"
        style={{
          background: "var(--input-bg)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
