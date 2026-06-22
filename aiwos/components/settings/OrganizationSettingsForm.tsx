"use client";

import { useState, useEffect } from "react";
import type { OrgApiResponse } from "@/lib/api/organizations";

interface OrgFormData {
  name: string;
  slug: string;
  industry: string;
  timezone: string;
  description: string;
}

interface OrganizationSettingsFormProps {
  org: OrgApiResponse | null;
  loading: boolean;
  onSave: (data: Partial<OrgFormData>) => Promise<void>;
}

export function OrganizationSettingsForm({
  org,
  loading,
  onSave,
}: OrganizationSettingsFormProps) {
  const [form, setForm] = useState<OrgFormData>({
    name: "",
    slug: "",
    industry: "",
    timezone: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name ?? "",
        slug: org.slug ?? "",
        industry: org.industry ?? "",
        timezone: org.timezone ?? "",
        description: org.description ?? "",
      });
    }
  }, [org]);

  const handleChange =
    (field: keyof OrgFormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setSaved(false);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      setSaved(true);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-xl border p-5 text-sm text-muted-foreground"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
        }}
      >
        Loading organization settings…
      </div>
    );
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
        <h2 className="text-base font-semibold text-foreground">
          Organization Settings
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage workspace identity and defaults.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Organization Name
          </span>
          <input
            type="text"
            value={form.name}
            onChange={handleChange("name")}
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
            value={form.slug}
            onChange={handleChange("slug")}
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
            value={form.industry}
            onChange={handleChange("industry")}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="">Select industry</option>
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
            value={form.timezone}
            onChange={handleChange("timezone")}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="">Select timezone</option>
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
            value={form.description}
            onChange={handleChange("description")}
            className="min-h-24 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </label>

        <div className="flex items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px disabled:opacity-60"
            style={{ background: "var(--purple)" }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && (
            <span className="text-xs" style={{ color: "var(--green)" }}>
              Saved!
            </span>
          )}
          {error && (
            <span className="text-xs" style={{ color: "var(--red)" }}>
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
