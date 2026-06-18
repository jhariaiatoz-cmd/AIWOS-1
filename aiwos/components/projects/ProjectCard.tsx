import Link from "next/link";
import type { Project } from "@/lib/data/projects";

interface ProjectCardProps {
  project: Project;
}

function StatusBadge({ status }: { status: "Active" | "On Hold" | "Completed" }) {
  let bgColor: string;
  let textColor: string;

  switch (status) {
    case "Active":
      bgColor = "rgba(6,182,212,0.12)";
      textColor = "var(--cyan)";
      break;
    case "On Hold":
      bgColor = "rgba(245,158,11,0.12)";
      textColor = "var(--amber)";
      break;
    case "Completed":
      bgColor = "rgba(16,185,129,0.12)";
      textColor = "var(--green)";
      break;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: bgColor,
        color: textColor,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: textColor }}
      />
      {status}
    </span>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col rounded-xl border p-5 transition-all duration-150 hover:border-[var(--border)] hover:-translate-y-px"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
        textDecoration: "none",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {project.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-semibold text-foreground">
            {project.progress}%
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${project.progress}%`,
              background:
                project.progress === 100 ? "var(--green)" : "var(--cyan)",
            }}
          />
        </div>
      </div>

      {/* Team avatars */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center">
          {project.agents.slice(0, 3).map((agent, idx) => (
            <div
              key={agent.id}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white"
              style={{
                background: agent.avatarColor,
                borderColor: "var(--card)",
                marginLeft: idx > 0 ? "-8px" : "0",
              }}
              title={agent.name}
            >
              {agent.initials}
            </div>
          ))}
          {project.agents.length > 3 && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white"
              style={{
                background: "var(--border)",
                borderColor: "var(--card)",
                marginLeft: "-8px",
                color: "var(--muted-foreground)",
              }}
              title={`+${project.agents.length - 3} more`}
            >
              +{project.agents.length - 3}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {project.agentCount} agents
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border-light)" }}>
        <span className="text-xs text-muted-foreground">
          Due{" "}
          {new Date(project.dueDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
          style={{
            background:
              project.priority === "High"
                ? "rgba(239,68,68,0.12)"
                : project.priority === "Medium"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(16,185,129,0.12)",
            color:
              project.priority === "High"
                ? "var(--red)"
                : project.priority === "Medium"
                  ? "var(--amber)"
                  : "var(--green)",
          }}
        >
          {project.priority}
        </span>
      </div>
    </Link>
  );
}
