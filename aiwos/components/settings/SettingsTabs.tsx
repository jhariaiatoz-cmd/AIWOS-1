"use client";

import { cn } from "@/lib/utils";

export type SettingsTab =
  | "organization"
  | "users"
  | "roles"
  | "billing"
  | "security"
  | "general";

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "organization", label: "Organization" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" },
  { id: "general", label: "General" },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <div
      className="mb-6 flex overflow-x-auto rounded-lg border p-1"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border-light)",
      }}
      role="tablist"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "h-9 shrink-0 rounded-md px-4 text-sm font-medium transition-colors",
              isActive
                ? "text-white"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
            style={isActive ? { background: "var(--purple)" } : undefined}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
