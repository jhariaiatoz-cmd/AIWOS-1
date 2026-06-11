"use client";

import { SearchInput } from "@/components/common/SearchInput";

interface ProjectSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ProjectSearchBar({
  value,
  onChange,
  placeholder = "Search projects...",
}: ProjectSearchBarProps) {
  return (
    <SearchInput
      label="Search projects"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
