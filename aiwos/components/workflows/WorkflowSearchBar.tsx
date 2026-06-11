"use client";

import { SearchInput } from "@/components/common/SearchInput";

interface WorkflowSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function WorkflowSearchBar({
  value,
  onChange,
  placeholder = "Search workflows...",
}: WorkflowSearchBarProps) {
  return (
    <SearchInput
      label="Search workflows"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
