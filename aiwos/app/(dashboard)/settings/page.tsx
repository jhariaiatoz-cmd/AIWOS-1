"use client";

import { useMemo, useState } from "react";
import { SettingsTabs, type SettingsTab } from "@/components/settings/SettingsTabs";
import { InviteUserForm } from "@/components/settings/InviteUserForm";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { SettingsEmptyPanel } from "@/components/settings/SettingsEmptyPanel";
import {
  RoleBadge,
  UserTable,
  type SettingsUser,
} from "@/components/settings/UserTable";
import { SummaryCard } from "@/components/common/SummaryCard";

const usersData: SettingsUser[] = [
  {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "Active",
    joinedOn: "2025-05-10",
  },
  {
    id: "user-2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Manager",
    status: "Active",
    joinedOn: "2025-05-11",
  },
  {
    id: "user-3",
    name: "Mike Johnson",
    email: "mike@example.com",
    role: "Viewer",
    status: "Active",
    joinedOn: "2025-05-12",
  },
  {
    id: "user-4",
    name: "Sarah Wilson",
    email: "sarah@example.com",
    role: "Editor",
    status: "Invited",
    joinedOn: "2025-05-18",
  },
];

const roleSummaries = [
  {
    role: "Admin" as const,
    description: "Full workspace access, billing, security, and user controls.",
    users: 1,
  },
  {
    role: "Manager" as const,
    description: "Manage agents, projects, tasks, and team assignments.",
    users: 1,
  },
  {
    role: "Editor" as const,
    description: "Create and update operational content and knowledge.",
    users: 1,
  },
  {
    role: "Viewer" as const,
    description: "Read-only access to dashboards, reports, and records.",
    users: 1,
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");

  const stats = useMemo(() => {
    return {
      users: usersData.length,
      active: usersData.filter((user) => user.status === "Active").length,
      invited: usersData.filter((user) => user.status === "Invited").length,
    };
  }, []);

  return (
    <div className="min-h-full">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your workspace, team access, and system preferences.
        </p>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "organization" && (
        <OrganizationSettingsForm
          organizationName="AIWOS"
          workspaceUrl="aiwos.example.com"
          industry="Technology"
          timezone="UTC-08:00 Pacific Time"
        />
      )}

      {activeTab === "users" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Total Users" value={stats.users} />
              <SummaryCard label="Active" value={stats.active} tone="green" />
              <SummaryCard label="Invited" value={stats.invited} tone="amber" />
            </div>
            <UserTable users={usersData} />
          </div>
          <InviteUserForm />
        </div>
      )}

      {activeTab === "roles" && (
        <div className="grid gap-4 md:grid-cols-2">
          {roleSummaries.map((role) => (
            <div
              key={role.role}
              className="rounded-xl border p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border-light)",
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <RoleBadge role={role.role} />
                <span className="text-xs text-muted-foreground">
                  {role.users} user
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {role.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "billing" && (
        <SettingsEmptyPanel
          title="Billing"
          description="Plan, invoices, and usage limits are represented with mock settings only."
        />
      )}

      {activeTab === "security" && (
        <SettingsEmptyPanel
          title="Security"
          description="Authentication, SSO, audit logs, and policy enforcement are not implemented in this frontend-only module."
        />
      )}

      {activeTab === "general" && (
        <SettingsEmptyPanel
          title="General"
          description="Default language, notification preferences, and workspace display options will live here."
        />
      )}
    </div>
  );
}
