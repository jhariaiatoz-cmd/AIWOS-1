"use client";

import { Search } from "lucide-react";
import { useId } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label,
}: SearchInputProps) {
  const id = useId();

  return (
    <div className="relative flex items-center">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search
        aria-hidden="true"
        size={14}
        className="pointer-events-none absolute left-3"
        style={{ color: "var(--faint)" }}
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border pr-3 pl-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
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
