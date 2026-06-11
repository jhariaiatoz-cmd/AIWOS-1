"use client";

interface OrganizationSettingsFormProps {
  organizationName: string;
  workspaceUrl: string;
  industry: string;
  timezone: string;
}

export function OrganizationSettingsForm({
  organizationName,
  workspaceUrl,
  industry,
  timezone,
}: OrganizationSettingsFormProps) {
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
          Organization Settings
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage workspace identity and defaults.
        </p>
      </div>

      <form className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Organization Name
          </span>
          <input
            type="text"
            defaultValue={organizationName}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Workspace URL
          </span>
          <input
            type="text"
            defaultValue={workspaceUrl}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Industry
          </span>
          <select
            defaultValue={industry}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option>Technology</option>
            <option>Finance</option>
            <option>Healthcare</option>
            <option>Retail</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Timezone
          </span>
          <select
            defaultValue={timezone}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option>UTC-08:00 Pacific Time</option>
            <option>UTC-05:00 Eastern Time</option>
            <option>UTC+00:00 Greenwich Mean Time</option>
            <option>UTC+01:00 Central European Time</option>
          </select>
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">
            Workspace Description
          </span>
          <textarea
            defaultValue="AIWOS coordinates agents, projects, tasks, and knowledge across the organization."
            className="min-h-24 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--purple)" }}
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
