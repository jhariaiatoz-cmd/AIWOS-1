"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FolderKanban,
  GitBranch,
  Users,
  ExternalLink,
  X,
  AlertCircle,
  BookOpen,
  Package,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { CommandCenterResponse, PromptPackData } from "@/lib/api/command_center";

interface ProjectCreatedCardProps {
  result: CommandCenterResponse;
  onDismiss: () => void;
}

const PROMPT_LABELS: { key: keyof PromptPackData; label: string }[] = [
  { key: "frontend", label: "Frontend Prompt" },
  { key: "backend", label: "Backend Prompt" },
  { key: "database", label: "Database Prompt" },
  { key: "testing", label: "Testing Prompt" },
  { key: "deployment", label: "Deployment Prompt" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors flex items-center gap-1"
      style={{
        background: copied ? "rgba(16,185,129,0.12)" : "var(--elevated)",
        color: copied ? "var(--green)" : "var(--muted-foreground)",
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PromptItem({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors hover:bg-[var(--elevated)]"
        style={{ color: "var(--foreground)" }}
      >
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {label}
        </span>
        <CopyButton text={content} />
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap"
          style={{ color: "var(--muted-foreground)", borderTop: "1px solid var(--border)" }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function ProjectCreatedCard({ result, onDismiss }: ProjectCreatedCardProps) {
  const router = useRouter();
  const [showPrompts, setShowPrompts] = useState(false);

  const milestones = [
    { label: "Project Created", done: !!result.project_id },
    { label: "Tasks Generated", done: result.task_count > 0 },
    { label: "Workflow Created", done: !!result.workflow_id },
    { label: "Project Blueprint Generated", done: !!result.blueprint },
    { label: "Prompt Pack Generated", done: !!result.prompt_pack },
  ];

  const availablePrompts = PROMPT_LABELS.filter(
    ({ key }) => result.prompt_pack?.[key]
  );

  return (
    <div
      className="mx-auto max-w-[640px] rounded-2xl border p-5 text-left shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {result.duplicate ? (
            <AlertCircle size={20} className="mt-0.5 shrink-0" style={{ color: "var(--amber)" }} />
          ) : (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {result.duplicate ? "Project Already Exists" : "Project Created Successfully"}
            </p>
            <p className="text-xs text-muted-foreground">{result.project_name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Checklist */}
      <div className="mb-4 space-y-1.5">
        {milestones.map((m) => (
          <div key={m.label} className="flex items-center gap-2 text-xs">
            <CheckCircle2
              size={14}
              style={{ color: m.done ? "var(--green)" : "var(--muted-foreground)" }}
            />
            <span style={{ color: m.done ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div
        className="mb-4 flex items-center gap-4 rounded-xl border px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <StatBadge
          icon={<FolderKanban size={14} />}
          label="Tasks"
          value={String(result.task_count)}
          color="var(--purple)"
        />
        <div className="h-8 w-px" style={{ background: "var(--border)" }} />
        <StatBadge
          icon={<GitBranch size={14} />}
          label="Workflow"
          value={result.workflow_id ? "Created" : "—"}
          color="var(--cyan)"
        />
        <div className="h-8 w-px" style={{ background: "var(--border)" }} />
        <StatBadge
          icon={<BookOpen size={14} />}
          label="Blueprint"
          value={result.blueprint ? "Ready" : "—"}
          color="var(--amber)"
        />
        {result.assigned_agents.length > 0 && (
          <>
            <div className="h-8 w-px" style={{ background: "var(--border)" }} />
            <StatBadge
              icon={<Users size={14} />}
              label="Agents"
              value={String(result.assigned_agents.length)}
              color="var(--green)"
            />
          </>
        )}
      </div>

      {/* Assigned agents */}
      {result.assigned_agents.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Assigned Agents</p>
          <div className="flex flex-wrap gap-1.5">
            {result.assigned_agents.map((agent) => (
              <span
                key={agent.id}
                className="rounded-full border px-2.5 py-1 text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                title={agent.role}
              >
                {agent.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Pack preview */}
      {availablePrompts.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowPrompts((p) => !p)}
            className="mb-2 flex w-full items-center justify-between text-xs font-medium"
            style={{ color: "var(--foreground)" }}
          >
            <span className="flex items-center gap-1.5">
              <Package size={12} style={{ color: "var(--purple)" }} />
              Prompt Pack
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--accent-glow)", color: "var(--purple)" }}
              >
                {availablePrompts.length}
              </span>
            </span>
            {showPrompts ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {showPrompts && (
            <div className="space-y-1.5">
              {availablePrompts.map(({ key, label }) => (
                <PromptItem
                  key={key}
                  label={label}
                  content={result.prompt_pack![key]!}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {result.project_id && (
          <button
            type="button"
            onClick={() => router.push(`/projects/${result.project_id}`)}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--purple)" }}
          >
            <ExternalLink size={12} />
            View Project
          </button>
        )}
        {result.workflow_id && (
          <button
            type="button"
            onClick={() => router.push("/workflows")}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors hover:text-primary"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <GitBranch size={12} />
            View Workflow
          </button>
        )}
      </div>
    </div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
