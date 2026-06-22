"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
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

interface Props {
  open: boolean;
  agentCount: number;
  onClose: () => void;
}

export function DeleteAllAgentsDialog({ open, agentCount, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => agentApi.deleteAll(currentOrgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] });
      onClose();
    },
  });

  const apiErr =
    error && typeof error === "object" && "response" in error
      ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to delete agents.")
      : error
      ? "Failed to delete agents."
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: "var(--red)" }} />
            Delete All Agents
          </DialogTitle>
          <DialogDescription>
            This will permanently delete all{" "}
            <span className="font-semibold text-foreground">{agentCount}</span>{" "}
            agent{agentCount !== 1 ? "s" : ""} in your organisation. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {apiErr && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)" }}>
            {apiErr}
          </p>
        )}

        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)", color: "var(--red)" }}
        >
          Warning: all agent configurations, assignments, and associated data will be removed.
        </div>

        <div className="flex flex-row-reverse gap-2 pt-2">
          <button
            onClick={() => mutate()}
            disabled={isPending || !currentOrgId}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--red, #ef4444)" }}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isPending ? "Deleting…" : `Delete All ${agentCount} Agent${agentCount !== 1 ? "s" : ""}`}
          </button>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
