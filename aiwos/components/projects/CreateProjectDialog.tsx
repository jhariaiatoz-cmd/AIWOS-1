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
import { projectApi } from "@/lib/api/projects";
import { taskApi } from "@/lib/api/tasks";
import { useAuthStore } from "@/lib/store/auth";
import type { ProjectRecommendationMetadata } from "@/lib/data/chat";

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === "object") {
      // Pydantic validation errors: detail is an array of {loc, msg, type} objects
      if ("detail" in data) {
        const detail = (data as { detail: unknown }).detail;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
          const messages = detail
            .map((d) =>
              d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)
            )
            .filter(Boolean);
          return messages.join("; ") || "Validation error";
        }
        if (detail && typeof detail === "object" && "msg" in detail) {
          return String((detail as { msg: unknown }).msg);
        }
      }
      // Some APIs return a top-level message field
      if ("message" in data) {
        return String((data as { message: unknown }).message);
      }
    }
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  initialDescription?: string;
  metadata?: ProjectRecommendationMetadata;
  ownerAgentId?: string;
}

export function CreateProjectDialog({
  open,
  onClose,
  initialName,
  initialDescription,
  metadata,
  ownerAgentId,
}: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Planning");
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setDescription(initialDescription ?? "");
      setStatus("Planning");
      setErrors({});
      setApiErr("");
      setSuccess(false);
      setTaskCount(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // Use || null so an empty string (e.g. when conv.agent_id is null) is
      // treated as no owner rather than an invalid UUID that causes a 422.
      const resolvedOwnerAgentId = ownerAgentId || null;

      const project = await projectApi.create({
        organization_id: currentOrgId!,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        owner_agent_id: resolvedOwnerAgentId,
      });

      console.log("Project created:", project);

      const phaseTasks = metadata?.phases ?? [];
      const milestones = metadata?.milestones ?? [];
      const tasks = metadata?.tasks ?? [];
      const priority = metadata?.priority ?? "Medium";

      if ((phaseTasks.length > 0 || milestones.length > 0 || tasks.length > 0) && currentOrgId) {
        // Clamp titles to 255 chars to satisfy the backend's max_length constraint.
        const safePhaseTask = phaseTasks.map((pt) => ({
          ...pt,
          title: pt.title.slice(0, 255),
        }));

        const payload = {
          project_id: project.id,
          organization_id: currentOrgId,
          ...(safePhaseTask.length > 0
            ? { phase_tasks: safePhaseTask }
            : { milestones, tasks }),
          priority,
          owner_agent_id: resolvedOwnerAgentId,
        };

        console.log("Task generation payload:", payload);

        try {
          const result = await taskApi.createFromProject(payload);
          console.log("Task generation response:", result);
          return { project, taskCount: result.count };
        } catch (err) {
          console.error("Task generation error:", err);
          throw err;
        }
      }

      return { project, taskCount: 0 };
    },
    onSuccess: ({ taskCount: count }) => {
      queryClient.invalidateQueries({ queryKey: ["projects", currentOrgId] });
      setTaskCount(count);
      setSuccess(true);
      setTimeout(handleClose, 1200);
    },
    onError: (err) => setApiErr(getErrorMessage(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setName("");
    setDescription("");
    setStatus("Planning");
    setErrors({});
    setApiErr("");
    setSuccess(false);
    setTaskCount(0);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiErr("");
    if (!name.trim()) { setErrors({ name: "Project name is required." }); return; }
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
  const selectStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Start a new AI-powered project for your organisation.
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
              {taskCount > 0
                ? `Project and ${taskCount} task${taskCount === 1 ? "" : "s"} created successfully`
                : "Project created!"}
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
                Project Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className={field}
                style={fieldStyle(errors.name)}
                placeholder="E-Commerce Platform"
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
                rows={3}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle()}
                placeholder="What is this project about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                className={field}
                style={selectStyle}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {metadata && (metadata.phases?.length > 0 || metadata.milestones.length > 0 || metadata.tasks.length > 0) && (
              <p className="text-[11px] text-muted-foreground rounded-lg px-3 py-2" style={{ background: "var(--elevated)" }}>
                {metadata.phases?.length > 0
                  ? `${metadata.phases.length} task${metadata.phases.length === 1 ? "" : "s"} across ${new Set(metadata.phases.map((p) => p.phase)).size} phase${new Set(metadata.phases.map((p) => p.phase)).size === 1 ? "" : "s"} will be created automatically.`
                  : [
                      metadata.milestones.length > 0 && `${metadata.milestones.length} milestone${metadata.milestones.length === 1 ? "" : "s"}`,
                      metadata.tasks.length > 0 && `${metadata.tasks.length} task${metadata.tasks.length === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" + ") + " will be created automatically."}
              </p>
            )}

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
                {isPending ? "Creating…" : "Create Project"}
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
