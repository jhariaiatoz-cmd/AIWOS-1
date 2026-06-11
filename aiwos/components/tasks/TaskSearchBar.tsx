"use client";

import { SearchInput } from "@/components/common/SearchInput";

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
    <SearchInput
      label="Search tasks"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
