"use client";

import { useState } from "react";
import { FolderPlus, CheckSquare, ChevronRight, Flag, Layers } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import type { ProjectRecommendationMetadata } from "@/lib/data/chat";

interface Props {
  metadata: ProjectRecommendationMetadata;
  agentId?: string;
}

// Build a structured description to pre-fill in the Create Project dialog.
// Encodes milestones + tasks + signals into the description field since
// the backend project model has no dedicated columns for these.
function buildPrefillDescription(m: ProjectRecommendationMetadata): string {
  const parts: string[] = [];
  if (m.description) parts.push(m.description);
  if (m.milestones.length > 0) {
    parts.push(`\nMilestones:\n${m.milestones.map((ms) => `• ${ms}`).join("\n")}`);
  }
  if (m.tasks.length > 0) {
    parts.push(`\nTasks:\n${m.tasks.map((t) => `• ${t}`).join("\n")}`);
  }
  parts.push(`\nPriority: ${m.priority}  |  Complexity: ${m.complexity}`);
  return parts.join("\n").trim();
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High:   { bg: "rgba(239,68,68,0.10)",   text: "var(--red)"    },
  Medium: { bg: "rgba(245,158,11,0.10)",  text: "var(--amber)"  },
  Low:    { bg: "rgba(16,185,129,0.10)",  text: "var(--green)"  },
};

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string }> = {
  High:   { bg: "rgba(139,92,246,0.10)",  text: "var(--purple)" },
  Medium: { bg: "rgba(99,102,241,0.10)",  text: "#6366f1"        },
  Low:    { bg: "rgba(16,185,129,0.10)",  text: "var(--green)"  },
};

export function ProjectRecommendationCard({ metadata, agentId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const priorityStyle  = PRIORITY_COLORS[metadata.priority]  ?? PRIORITY_COLORS.Medium;
  const complexityStyle = COMPLEXITY_COLORS[metadata.complexity] ?? COMPLEXITY_COLORS.Medium;

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5"
          style={{ borderBottom: "1px solid var(--border-light)" }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--accent-glow)" }}
          >
            <FolderPlus size={14} style={{ color: "var(--purple)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--purple)" }}>
              Project Recommendation
            </p>
            <p className="truncate text-sm font-semibold text-foreground leading-tight">
              {metadata.name}
            </p>
          </div>
        </div>

        {/* Priority + Complexity badges */}
        <div className="flex items-center gap-2 px-3.5 pt-2.5">
          <span
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: priorityStyle.bg, color: priorityStyle.text }}
          >
            <Flag size={9} />
            {metadata.priority} Priority
          </span>
          <span
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: complexityStyle.bg, color: complexityStyle.text }}
          >
            <Layers size={9} />
            {metadata.complexity} Complexity
          </span>
        </div>

        {/* Description */}
        {metadata.description && (
          <p className="px-3.5 pt-2 pb-0 text-[12px] leading-relaxed text-muted-foreground">
            {metadata.description}
          </p>
        )}

        {/* Milestones */}
        {metadata.milestones.length > 0 && (
          <div className="px-3.5 pt-2.5 pb-0">
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--faint)" }}
            >
              Milestones
            </p>
            <ol className="flex flex-col gap-1">
              {metadata.milestones.map((ms, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-foreground">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: "var(--purple)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{ms}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tasks */}
        {metadata.tasks.length > 0 && (
          <div className="px-3.5 py-2.5">
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--faint)" }}
            >
              Suggested Tasks
            </p>
            <ul className="flex flex-col gap-1.5">
              {metadata.tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-foreground">
                  <CheckSquare
                    size={13}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--purple)" }}
                  />
                  <span className="leading-relaxed">{task}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end px-3.5 py-2"
          style={{ borderTop: "1px solid var(--border-light)", background: "var(--elevated)" }}
        >
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
            style={{ background: "var(--purple)" }}
          >
            Create Project
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialName={metadata.name}
        initialDescription={buildPrefillDescription(metadata)}
        metadata={metadata}
        ownerAgentId={agentId}
      />
    </>
  );
}
