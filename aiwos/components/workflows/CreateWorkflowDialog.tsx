"use client";

import { useState } from "react";
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
import { workflowApi } from "@/lib/api/workflows";
import { useAuthStore } from "@/lib/store/auth";

function apiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: string } } })
      .response?.data?.detail;
    if (detail) return String(detail);
  }
  return "Something went wrong. Please try again.";
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkflowDialog({ open, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Draft");
  const [graphDef, setGraphDef] = useState("{}");
  const [errors, setErrors] = useState<{
    name?: string;
    graphDef?: string;
  }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: (parsedGraph: unknown) =>
      workflowApi.create({
        organization_id: currentOrgId!,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        graph_definition: parsedGraph,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", currentOrgId] });
      setSuccess(true);
      setTimeout(handleClose, 900);
    },
    onError: (err) => setApiErr(apiError(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setName("");
    setDescription("");
    setStatus("Draft");
    setGraphDef("{}");
    setErrors({});
    setApiErr("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiErr("");
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Workflow name is required.";
    let parsed: unknown;
    try {
      parsed = JSON.parse(graphDef.trim() || "{}");
    } catch {
      errs.graphDef = "Must be valid JSON.";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    mutate(parsed);
  };

  const field =
    "h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors";
  const fieldStyle = (err?: string) => ({
    background: "var(--input-bg)",
    borderColor: err ? "var(--red)" : "var(--border)",
    color: "var(--foreground)",
  });
  const selectStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>
            Define a new automated workflow for your organisation.
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
              Workflow created!
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
                Workflow Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className={field}
                style={fieldStyle(errors.name)}
                placeholder="Customer Onboarding"
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
                Description
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle()}
                placeholder="What does this workflow automate?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select className={field} style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Graph Definition (JSON) <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <textarea
                rows={4}
                className="w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs outline-none transition-colors"
                style={fieldStyle(errors.graphDef)}
                placeholder='{}'
                value={graphDef}
                onChange={(e) => setGraphDef(e.target.value)}
                spellCheck={false}
              />
              {errors.graphDef ? (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.graphDef}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  JSON object describing the workflow graph nodes and edges.
                </p>
              )}
            </div>

            <div
              className="-mx-4 -mb-4 flex flex-row-reverse gap-2 rounded-b-xl border-t px-4 py-3"
              style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
            >
              <button
                type="submit"
                disabled={isPending || !currentOrgId}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--purple)" }}
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                {isPending ? "Creating…" : "Create Workflow"}
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
