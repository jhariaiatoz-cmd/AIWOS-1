"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { commandSuggestions } from "@/lib/data/dashboard";
import { useAuthStore } from "@/lib/store/auth";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { conversationApi } from "@/lib/api/conversations";

export function CommandHero() {
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, currentOrgId } = useAuthStore();
  const setPendingConversationId = useWorkspaceStore(
    (s) => s.setPendingConversationId
  );

  const isAuthenticated = !user?.isGuest && !!currentOrgId;

  const executeCommand = useMutation({
    mutationFn: async (prompt: string) => {
      if (!currentOrgId) throw new Error("No organization found.");
      const conv = await conversationApi.create({
        organization_id: currentOrgId,
        user_id: user?.id,
        prompt,
      });
      return conv.id;
    },
    onSuccess: (conversationId) => {
      setPendingConversationId(conversationId);
      setCommand("");
      router.push("/chat");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  function handleSubmit() {
    const prompt = command.trim();
    if (!prompt || executeCommand.isPending) return;
    setError(null);

    if (!isAuthenticated) {
      router.push("/chat");
      setCommand("");
      return;
    }

    executeCommand.mutate(prompt);
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mb-6 px-4 pt-8 pb-6 text-center">
      <h1 className="mb-1.5 text-2xl font-bold text-foreground">
        Good Morning, {firstName} 👋
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Here&apos;s what your AI workforce is doing today.
      </p>

      {/* Command input */}
      <div className="relative mx-auto mb-2 max-w-[640px]">
        <input
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={executeCommand.isPending}
          className="w-full rounded-2xl border px-4 py-3.5 pr-14 text-sm outline-none transition-all focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--card)",
            borderColor: error ? "#ef4444" : "var(--border)",
            color: "var(--foreground)",
          }}
          placeholder="What would you like your workforce to do today?"
          aria-label="Workforce command"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!command.trim() || executeCommand.isPending}
          className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--purple)" }}
          aria-label="Send command"
        >
          {executeCommand.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* Status row */}
      <div className="mb-4 flex min-h-[20px] items-center justify-center">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {executeCommand.isPending && (
          <p className="animate-pulse text-xs text-muted-foreground">
            Your workforce is on it…
          </p>
        )}
      </div>

      {/* Suggestion chips — hidden while executing */}
      {!executeCommand.isPending && (
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
  );
}
