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
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { useAuthStore } from "@/lib/store/auth";

interface Props {
  agent: AgentApiResponse | null;
  onClose: () => void;
}

export function DeleteAgentDialog({ agent, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => agentApi.delete(agent!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] });
      onClose();
    },
  });

  const apiErr =
    error && typeof error === "object" && "response" in error
      ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to delete agent.")
      : error
      ? "Failed to delete agent."
      : null;

  return (
    <Dialog open={!!agent} onOpenChange={(v) => !v && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: "var(--red)" }} />
            Delete Agent
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{agent?.name}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {apiErr && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)" }}>
            {apiErr}
          </p>
        )}

        <div className="flex flex-row-reverse gap-2 pt-2">
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--red, #ef4444)" }}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isPending ? "Deleting…" : "Delete Agent"}
          </button>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
