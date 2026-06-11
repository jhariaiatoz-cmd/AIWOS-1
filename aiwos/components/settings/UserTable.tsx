"use client";

import { MoreVertical } from "lucide-react";

export type UserRole = "Admin" | "Manager" | "Editor" | "Viewer";
export type UserStatus = "Active" | "Invited" | "Suspended";

export interface SettingsUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedOn: string;
}

interface UserTableProps {
  users: SettingsUser[];
}

export function RoleBadge({ role }: { role: UserRole }) {
  const styles = {
    Admin: {
      background: "rgba(124,58,237,0.12)",
      color: "var(--purple)",
    },
    Manager: {
      background: "rgba(6,182,212,0.12)",
      color: "var(--cyan)",
    },
    Editor: {
      background: "rgba(245,158,11,0.12)",
      color: "var(--amber)",
    },
    Viewer: {
      background: "rgba(16,185,129,0.12)",
      color: "var(--green)",
    },
  } satisfies Record<UserRole, { background: string; color: string }>;

  return (
    <span
      className="inline-flex rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: styles[role].background,
        color: styles[role].color,
      }}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles = {
    Active: {
      background: "rgba(16,185,129,0.12)",
      color: "var(--green)",
    },
    Invited: {
      background: "rgba(245,158,11,0.12)",
      color: "var(--amber)",
    },
    Suspended: {
      background: "rgba(239,68,68,0.12)",
      color: "var(--red)",
    },
  } satisfies Record<UserStatus, { background: string; color: string }>;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: styles[status].background,
        color: styles[status].color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: styles[status].color }}
      />
      {status}
    </span>
  );
}

export function UserTable({ users }: UserTableProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border-light)",
                background: "var(--surface)",
              }}
            >
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                User Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Joined On
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-[var(--accent)]"
                style={{
                  borderBottom:
                    idx < users.length - 1
                      ? "1px solid var(--border-light)"
                      : "none",
                }}
              >
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.joinedOn).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
                    aria-label={`Actions for ${user.name}`}
                  >
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
