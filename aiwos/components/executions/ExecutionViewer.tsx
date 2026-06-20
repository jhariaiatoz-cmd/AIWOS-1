"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  ArrowLeftRight,
  ServerCrash,
  Ban,
} from "lucide-react";
import { executionApi, type ExecutionApiResponse, type ExecutionErrorType } from "@/lib/api/executions";

interface ExecutionViewerProps {
  executionId: string;
  taskTitle: string;
  onClose: () => void;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

type BadgeVariant =
  | "success"
  | "retried"
  | "fallback"
  | "failed"
  | "quota"
  | "unavailable"
  | "pending"
  | "running";

const BADGE_CONFIG: Record<
  BadgeVariant,
  { label: string; color: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  success:     { label: "Success",            color: "var(--green)",  Icon: CheckCircle },
  retried:     { label: "Retried",            color: "var(--cyan)",   Icon: RefreshCw },
  fallback:    { label: "Fallback Used",      color: "var(--amber)",  Icon: ArrowLeftRight },
  failed:      { label: "Failed",             color: "var(--red)",    Icon: AlertCircle },
  quota:       { label: "Quota Exhausted",    color: "var(--amber)",  Icon: Ban },
  unavailable: { label: "Provider Unavailable", color: "var(--red)", Icon: ServerCrash },
  pending:     { label: "Pending",            color: "var(--amber)",  Icon: Clock },
  running:     { label: "Running",            color: "var(--cyan)",   Icon: Loader2 },
};

function resolveBadgeVariant(execution: ExecutionApiResponse): BadgeVariant {
  const errType: ExecutionErrorType | null | undefined =
    execution.error_type ?? execution.output_data?.error_type;

  if (execution.status === "failed") {
    if (errType === "quota_exceeded") return "quota";
    if (errType === "service_unavailable") return "unavailable";
    return "failed";
  }
  if (execution.status === "completed") {
    const hasFallback =
      execution.fallback_provider ??
      execution.output_data?.fallback_provider;
    if (hasFallback) return "fallback";
    if (execution.retry_count > 0) return "retried";
    return "success";
  }
  if (execution.status === "pending") return "pending";
  return "running";
}

function StatusBadge({ execution }: { execution: ExecutionApiResponse }) {
  const variant = resolveBadgeVariant(execution);
  const { label, color, Icon } = BADGE_CONFIG[variant];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <Icon size={10} />
      {label}
    </span>
  );
}

// ── Quota / rate-limit error panel ────────────────────────────────────────────

const QUOTA_COPY: Record<string, { title: string; description: string }> = {
  quota_exceeded: {
    title: "AI Provider Quota Reached",
    description:
      "The selected AI provider has exhausted its free-tier request quota for this period.",
  },
  rate_limited: {
    title: "AI Provider Rate Limited",
    description:
      "The selected AI provider is throttling requests. The system already retried with backoff but could not complete the task.",
  },
  service_unavailable: {
    title: "AI Provider Unavailable",
    description:
      "The selected AI provider returned a service-unavailable error. All configured fallback providers were also tried.",
  },
};

function QuotaErrorPanel({ errorType }: { errorType: ExecutionErrorType | null | undefined }) {
  const copy = QUOTA_COPY[errorType ?? ""] ?? {
    title: "AI Provider Limit Reached",
    description:
      "The selected AI provider has exhausted its request quota or rate limit.",
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Ban size={16} className="shrink-0 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">{copy.title}</span>
      </div>
      <p className="mb-3 text-sm text-amber-200/80">{copy.description}</p>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Suggested actions:</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          Retry the task in a few minutes
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          Upgrade the AI provider plan or add billing details
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          Switch the agent to a different provider (OpenAI / Anthropic / Gemini)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          Contact your administrator to configure additional provider API keys
        </li>
      </ul>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExecutionViewer({ executionId, taskTitle, onClose }: ExecutionViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: execution, isPending, error } = useQuery<ExecutionApiResponse>({
    queryKey: ["execution", executionId],
    queryFn: () => executionApi.get(executionId),
    staleTime: 30_000,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const content = execution?.output_data?.content ?? null;

  const errorType: ExecutionErrorType | null | undefined =
    execution?.error_type ?? execution?.output_data?.error_type;

  const isProviderError =
    execution?.status === "failed" &&
    (errorType === "quota_exceeded" ||
      errorType === "rate_limited" ||
      errorType === "service_unavailable");

  const hasFallback =
    execution?.fallback_provider ?? execution?.output_data?.fallback_provider;

  const providerUsed =
    execution?.provider_used ?? execution?.output_data?.provider_used;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
        >
          <div className="min-w-0">
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">Deliverable</p>
            <h2 className="truncate text-base font-semibold text-foreground">{taskTitle}</h2>
            {execution && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge execution={execution} />
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formatMs(execution.execution_time_ms)}
                </span>
                {execution.token_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Zap size={11} />
                    {execution.token_count.toLocaleString()} tokens
                  </span>
                )}
                {providerUsed && (
                  <span className="rounded bg-[var(--border)] px-1.5 py-0.5 font-mono text-[10px]">
                    {hasFallback
                      ? `${execution.fallback_provider ?? execution.output_data?.fallback_provider} (fallback)`
                      : providerUsed}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isPending && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Loading deliverable…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              Failed to load execution output.
            </div>
          )}

          {execution?.status === "failed" && (
            isProviderError ? (
              <QuotaErrorPanel errorType={errorType} />
            ) : (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">Execution failed: </span>
                  {execution.error_message ?? "Unknown error"}
                </span>
              </div>
            )
          )}

          {execution?.status === "completed" && hasFallback && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              <ArrowLeftRight size={16} className="mt-0.5 shrink-0" />
              <span>
                Primary provider{" "}
                <span className="font-mono font-semibold">
                  {execution.output_data?.fallback_provider ?? execution.fallback_provider}
                </span>{" "}
                was quota-limited. Task completed via fallback provider{" "}
                <span className="font-mono font-semibold">{providerUsed}</span>.
              </span>
            </div>
          )}

          {execution?.status === "completed" && !hasFallback && execution.retry_count > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-400">
              <RefreshCw size={16} className="shrink-0" />
              Completed after {execution.retry_count} retr{execution.retry_count === 1 ? "y" : "ies"}.
            </div>
          )}

          {content && (
            <div className="aiwos-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}

          {!isPending && !error && !content && execution?.status !== "failed" && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No output available for this execution.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
