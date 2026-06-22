"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { SettingsTabs, type SettingsTab } from "@/components/settings/SettingsTabs";
import { InviteUserForm } from "@/components/settings/InviteUserForm";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { SettingsEmptyPanel } from "@/components/settings/SettingsEmptyPanel";
import {
  RoleBadge,
  UserTable,
  type SettingsUser,
  type UserRole,
} from "@/components/settings/UserTable";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CreateOrganizationDialog } from "@/components/organizations/CreateOrganizationDialog";
import { useAuthStore } from "@/lib/store/auth";
import { orgApi, type OrgApiResponse } from "@/lib/api/organizations";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: "Full workspace access, billing, security, and user controls.",
  Manager: "Manage agents, projects, tasks, and team assignments.",
  Editor: "Create and update operational content and knowledge.",
  Viewer: "Read-only access to dashboards, reports, and records.",
};

const KNOWN_ROLES: UserRole[] = ["Admin", "Manager", "Editor", "Viewer"];

function normalizeRole(role: string): UserRole {
  const normalized =
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  return KNOWN_ROLES.includes(normalized as UserRole)
    ? (normalized as UserRole)
    : "Viewer";
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const { currentOrgId } = useAuthStore();

  const [org, setOrg] = useState<OrgApiResponse | null>(null);
  const [members, setMembers] = useState<SettingsUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }

    Promise.all([
      orgApi.get(currentOrgId),
      orgApi.getMembers(currentOrgId),
    ])
      .then(([orgData, memberData]) => {
        setOrg(orgData);
        setMembers(
          memberData.map((m) => ({
            id: m.id,
            name: m.full_name || m.email.split("@")[0],
            email: m.email,
            role: normalizeRole(m.role),
            status: "Active" as const,
            joinedOn: m.joined_at,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const stats = useMemo(
    () => ({
      users: members.length,
      active: members.filter((u) => u.status === "Active").length,
      invited: members.filter((u) => u.status === "Invited").length,
    }),
    [members]
  );

  const roleSummaries = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      counts[m.role] = (counts[m.role] ?? 0) + 1;
    });
    return KNOWN_ROLES.map((role) => ({
      role,
      description: ROLE_DESCRIPTIONS[role] ?? "",
      users: counts[role] ?? 0,
    }));
  }, [members]);

  const handleSaveOrg = async (
    data: Partial<{
      name: string;
      slug: string;
      industry: string;
      timezone: string;
      description: string;
    }>
  ) => {
    if (!currentOrgId) return;
    const updated = await orgApi.update(currentOrgId, data);
    setOrg(updated);
  };

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your workspace, team access, and system preferences.
          </p>
        </div>
        {activeTab === "organization" && (
          <button
            onClick={() => setCreateOrgOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--purple)" }}
          >
            <Plus size={16} />
            New Organisation
          </button>
        )}
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "organization" && (
        <OrganizationSettingsForm
          org={org}
          loading={loading}
          onSave={handleSaveOrg}
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
            <UserTable users={members} />
          </div>
          <InviteUserForm
            orgId={currentOrgId ?? null}
            onInvited={() => {
              if (!currentOrgId) return;
              orgApi.getMembers(currentOrgId).then((memberData) => {
                setMembers(
                  memberData.map((m) => ({
                    id: m.id,
                    name: m.full_name || m.email.split("@")[0],
                    email: m.email,
                    role: normalizeRole(m.role),
                    status: "Active" as const,
                    joinedOn: m.joined_at,
                  }))
                );
              });
            }}
          />
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
                  {role.users} {role.users === 1 ? "user" : "users"}
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
          description="Plan, invoices, and usage limits are not yet implemented."
        />
      )}

      {activeTab === "security" && (
        <SettingsEmptyPanel
          title="Security"
          description="Authentication, SSO, audit logs, and policy enforcement are not yet implemented."
        />
      )}

      {activeTab === "general" && (
        <SettingsEmptyPanel
          title="General"
          description="Default language, notification preferences, and workspace display options will live here."
        />
      )}

      <CreateOrganizationDialog
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
      />
    </div>
  );
}
