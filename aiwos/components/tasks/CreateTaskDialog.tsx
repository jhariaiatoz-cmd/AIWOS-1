"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { taskApi } from "@/lib/api/tasks";
import { projectApi } from "@/lib/api/projects";
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

export function CreateTaskDialog({ open, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Todo");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<{ title?: string; projectId?: string }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch projects for project selector
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: open && !!currentOrgId,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      taskApi.create({
        organization_id: currentOrgId!,
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setSuccess(true);
      setTimeout(handleClose, 900);
    },
    onError: (err) => setApiErr(apiError(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setTitle("");
    setDescription("");
    setProjectId("");
    setPriority("Medium");
    setStatus("Todo");
    setDueDate("");
    setErrors({});
    setApiErr("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiErr("");
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (!projectId) errs.projectId = "Please select a project.";
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
  const selectStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Assign a new task to an AI agent in a project.
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
            <p className="text-sm font-medium text-foreground">Task created!</p>
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
                Title <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className={field}
                style={fieldStyle(errors.title)}
                placeholder="Build login page"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              {errors.title && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.title}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Project <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <select
                className={field}
                style={fieldStyle(errors.projectId)}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.projectId && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.projectId}</p>
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
                placeholder="What needs to be done?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <select className={field} style={selectStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select className={field} style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <input
                type="date"
                className={field}
                style={fieldStyle()}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
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
                {isPending ? "Creating…" : "Create Task"}
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
