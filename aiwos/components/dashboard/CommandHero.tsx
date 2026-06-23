"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { commandSuggestions } from "@/lib/data/dashboard";
import { useAuthStore } from "@/lib/store/auth";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { conversationApi } from "@/lib/api/conversations";
import { AgentSelectModal } from "./AgentSelectModal";

export function CommandHero() {
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoResize();
  }, [command, autoResize]);
  const router = useRouter();
  const { user, currentOrgId } = useAuthStore();
  const setPendingConversationId = useWorkspaceStore(
    (s) => s.setPendingConversationId
  );

  const isAuthenticated = !user?.isGuest && !!currentOrgId;

  // Pre-load agents so the modal opens instantly
  const { data: agents = [] } = useQuery({
    queryKey: ["agents", currentOrgId],
    queryFn: () => agentApi.list(currentOrgId!),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const createConversation = useMutation({
    mutationFn: async (agent: AgentApiResponse) => {
      if (!currentOrgId) throw new Error("No organization found.");
      const conv = await conversationApi.create({
        organization_id: currentOrgId,
        user_id: user?.id,
        agent_id: agent.id,
        prompt: command.trim() || undefined,
      });
      return conv.id;
    },
    onSuccess: (conversationId) => {
      setPendingConversationId(conversationId);
      setCommand("");
      setShowModal(false);
      router.push("/chat");
    },
    onError: (err) => {
      setShowModal(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  function handleSubmit() {
    const prompt = command.trim();
    if (!prompt || createConversation.isPending) return;
    setError(null);

    if (!isAuthenticated) {
      router.push("/chat");
      setCommand("");
      return;
    }

    // Open agent selection modal — user picks who handles this
    setShowModal(true);
  }

  function handleAgentSelect(agent: AgentApiResponse) {
    createConversation.mutate(agent);
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <div className="mb-6 px-4 pt-8 pb-6 text-center">
        <h1 className="mb-1.5 text-2xl font-bold text-foreground">
          Good Morning, {firstName} 👋
        </h1>
        <p className="mb-7 text-sm text-muted-foreground">
          Here&apos;s what your AI workforce is doing today.
        </p>

        {/* Command input */}
        <div className="relative mx-auto mb-2 max-w-[640px]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={createConversation.isPending}
            className="w-full rounded-2xl border px-4 py-3.5 pr-14 text-sm outline-none transition-all focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 resize-none"
            style={{
              background: "var(--card)",
              borderColor: error ? "var(--destructive)" : "var(--border)",
              color: "var(--foreground)",
              minHeight: "40px",
              maxHeight: "200px",
              overflowY: "hidden",
            }}
            placeholder="What would you like your workforce to do today?"
            aria-label="Workforce command"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!command.trim() || createConversation.isPending}
            className="absolute right-2.5 bottom-2.5 flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--purple)" }}
            aria-label="Send command"
          >
            {createConversation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {/* Status row */}
        <div className="mb-4 flex min-h-[20px] items-center justify-center">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {createConversation.isPending && (
            <p className="animate-pulse text-xs text-muted-foreground">
              Starting conversation…
            </p>
          )}
        </div>

        {/* Suggestion chips — hidden while executing */}
        {!createConversation.isPending && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {commandSuggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => {
                  setCommand(s.text);
                  setError(null);
                }}
                className="rounded-full border px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary hover:text-primary"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--accent-glow)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--card)";
                }}
              >
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AgentSelectModal
          agents={agents}
          prompt={command}
          isSubmitting={createConversation.isPending}
          onSelect={handleAgentSelect}
          onClose={() => !createConversation.isPending && setShowModal(false)}
        />
      )}
    </>
  );
}
