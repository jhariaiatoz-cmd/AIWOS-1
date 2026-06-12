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
import { agentApi } from "@/lib/api/agents";
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

export function CreateAgentDialog({ open, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("Created");
  const [isManager, setIsManager] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    role?: string;
    goal?: string;
    instructions?: string;
  }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      agentApi.create({
        organization_id: currentOrgId!,
        name: name.trim(),
        role: role.trim(),
        goal: goal.trim(),
        instructions: instructions.trim(),
        status,
        is_manager: isManager,
        tools: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] });
      setSuccess(true);
      setTimeout(handleClose, 900);
    },
    onError: (err) => setApiErr(apiError(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setName("");
    setRole("");
    setGoal("");
    setInstructions("");
    setStatus("Created");
    setIsManager(false);
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
    if (!role.trim()) errs.role = "Role is required.";
    if (!goal.trim()) errs.goal = "Goal is required.";
    if (!instructions.trim()) errs.instructions = "Instructions are required.";
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
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Define a new AI agent for your organisation.
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
            <p className="text-sm font-medium text-foreground">Agent created!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {apiErr && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)" }}>
                {apiErr}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Name <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  className={field}
                  style={fieldStyle(errors.name)}
                  placeholder="Research Agent"
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
                  Role <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  className={field}
                  style={fieldStyle(errors.role)}
                  placeholder="Research Analyst"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                {errors.role && (
                  <p className="text-xs" style={{ color: "var(--red)" }}>{errors.role}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Goal <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle(errors.goal)}
                placeholder="What should this agent accomplish?"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
              {errors.goal && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.goal}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Instructions <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle(errors.instructions)}
                placeholder="How should this agent behave and operate?"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              {errors.instructions && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{errors.instructions}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select className={field} style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Created">Created</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 justify-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={isManager}
                    onChange={(e) => setIsManager(e.target.checked)}
                    className="accent-[var(--purple)] h-3.5 w-3.5"
                  />
                  Manager agent
                </label>
              </div>
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
                {isPending ? "Creating…" : "Create Agent"}
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
