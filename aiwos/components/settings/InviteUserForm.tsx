"use client";

import { useState } from "react";
import { CheckCircle, Send, XCircle } from "lucide-react";
import { orgApi } from "@/lib/api/organizations";

const ROLES = ["Admin", "Manager", "Editor", "Viewer"] as const;
type Role = (typeof ROLES)[number];

interface Props {
  orgId: string | null;
  onInvited?: () => void;
}

export function InviteUserForm({ orgId, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = isValidEmail && role !== "" && orgId !== null && status !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !orgId) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      await orgApi.invite(orgId, email, role as Role);
      setStatus("success");
      setEmail("");
      setRole("");
      onInvited?.();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to send invitation. Please try again.";
      setErrorMessage(detail);
      setStatus("error");
    }
  }

  function handleReset() {
    setStatus("idle");
    setErrorMessage("");
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">Invite New User</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a teammate to your organization.
        </p>
      </div>

      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle size={32} className="text-green-500" />
          <p className="text-sm font-medium text-foreground">Invitation sent!</p>
          <p className="text-xs text-muted-foreground">
            They will receive a link to join your organization.
          </p>
          <button
            onClick={handleReset}
            className="mt-1 text-xs underline text-muted-foreground hover:text-foreground transition-colors"
          >
            Invite another
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="Enter email address"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-1"
              style={{
                background: "var(--input-bg)",
                borderColor: status === "error" ? "var(--red, #ef4444)" : "var(--border)",
                color: "var(--foreground)",
              }}
              disabled={status === "loading"}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role | "")}
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border)",
                color: role === "" ? "var(--muted-foreground)" : "var(--foreground)",
              }}
              disabled={status === "loading"}
            >
              <option value="" disabled>
                Select role
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
              <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            style={{ background: "var(--purple)" }}
          >
            {status === "loading" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send size={15} />
            )}
            {status === "loading" ? "Sending…" : "Invite"}
          </button>
        </form>
      )}
    </div>
  );
}
