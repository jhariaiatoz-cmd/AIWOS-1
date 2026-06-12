"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orgApi } from "@/lib/api/organizations";
import { useAuthStore } from "@/lib/store/auth";

function apiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: string } } })
      .response?.data?.detail;
    if (detail) return String(detail);
  }
  return "Something went wrong. Please try again.";
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateOrganizationDialog({ open, onClose }: Props) {
  const { currentOrgId, setCurrentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => orgApi.create(name.trim(), slug.trim()),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      if (!currentOrgId) setCurrentOrgId(org.id);
      setSuccess(true);
      setTimeout(handleClose, 900);
    },
    onError: (err) => setApiErr(apiError(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setName("");
    setSlug("");
    setSlugDirty(false);
    setErrors({});
    setApiErr("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiErr("");
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!slug.trim()) errs.slug = "Slug is required.";
    else if (!/^[a-z0-9-]+$/.test(slug.trim()))
      errs.slug = "Only lowercase letters, numbers, and hyphens.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    mutate();
  };

  const field =
    "h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors";
  const fieldStyle = (err?: string) => ({
    background: "var(--input-bg)",
    borderColor: err ? "var(--red)" : "var(--border)",
    color: "var(--foreground)",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Add a new workspace for your team and AI agents.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <Check size={22} style={{ color: "var(--green)" }} />
            </div>
            <p className="text-sm font-medium text-foreground">
              Organization created!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {apiErr && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)" }}>
                {apiErr}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Organization Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className={field}
                style={fieldStyle(errors.name)}
                placeholder="Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.name}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Slug <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className={field}
                style={fieldStyle(errors.slug)}
                placeholder="acme-corporation"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugDirty(true); }}
              />
              {errors.slug ? (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.slug}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Used in URLs — lowercase letters, numbers, hyphens only.
                </p>
              )}
            </div>

            <div
              className="-mx-4 -mb-4 flex flex-row-reverse gap-2 rounded-b-xl border-t px-4 py-3"
              style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
            >
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--purple)" }}
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                {isPending ? "Creating…" : "Create Organization"}
              </button>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
