"use client";

import { SearchInput } from "@/components/common/SearchInput";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search agents...",
}: SearchBarProps) {
  return (
    <SearchInput
      label="Search agents"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
