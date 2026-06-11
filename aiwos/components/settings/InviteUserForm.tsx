"use client";

import { Send } from "lucide-react";

export function InviteUserForm() {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Invite New User
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Send a mock invitation to a teammate.
        </p>
      </div>

      <form className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input
            type="email"
            placeholder="Enter email address"
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select
            defaultValue=""
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="" disabled>
              Select role
            </option>
            <option>Admin</option>
            <option>Manager</option>
            <option>Editor</option>
            <option>Viewer</option>
          </select>
        </label>

        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          <Send size={15} />
          Invite
        </button>
      </form>
    </div>
  );
}
