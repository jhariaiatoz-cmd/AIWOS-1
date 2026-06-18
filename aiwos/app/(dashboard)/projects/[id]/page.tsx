"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckSquare, Circle, Loader2, ListChecks, User } from "lucide-react";
import { projectApi } from "@/lib/api/projects";
import { taskApi, type TaskApiResponse } from "@/lib/api/tasks";
import { useAuthStore } from "@/lib/store/auth";

function priorityColor(p: string): string {
  if (p === "High" || p === "Critical") return "var(--red)";
  if (p === "Medium") return "var(--amber)";
  return "var(--green)";
}

function statusIcon(s: string) {
  if (s === "Done") return <CheckSquare size={14} style={{ color: "var(--green)" }} />;
  if (s === "In Progress") return <Circle size={14} style={{ color: "var(--cyan)" }} />;
  if (s === "Cancelled") return <Circle size={14} style={{ color: "var(--faint)" }} />;
  return <Circle size={14} style={{ color: "var(--border)" }} />;
}

function TaskRow({ task }: { task: TaskApiResponse }) {
  const done = task.status === "Done";
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ borderBottom: "1px solid var(--border-light)" }}
    >
      {statusIcon(task.status)}
      <span
        className="flex-1 text-sm"
        style={{
          color: done ? "var(--faint)" : "var(--foreground)",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {task.title}
      </span>
      {task.assigned_agent && (
        <span
          className="shrink-0 hidden sm:flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--accent-glow)", color: "var(--purple)" }}
          title={task.assigned_agent.role}
        >
          <User size={9} />
          {task.assigned_agent.name}
        </span>
      )}
      <span
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{
          background: "rgba(0,0,0,0.12)",
          color: priorityColor(task.priority),
        }}
      >
        {task.priority}
      </span>
      <span
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
      >
        {task.status}
      </span>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrgId } = useAuthStore();

  const { data: project, isPending: projectPending } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectApi.get(id),
    enabled: !!id,
  });

  const { data: tasks = [], isPending: tasksPending } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => taskApi.list(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (projectPending) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" />
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }

  return (
    <div className="min-h-full max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {/* Project header */}
      <div
        className="mb-6 rounded-xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
      >
        <div className="mb-1 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background:
                project.status === "Active"
                  ? "rgba(6,182,212,0.12)"
                  : project.status === "Completed"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(245,158,11,0.12)",
              color:
                project.status === "Active"
                  ? "var(--cyan)"
                  : project.status === "Completed"
                    ? "var(--green)"
                    : "var(--amber)",
            }}
          >
            {project.status}
          </span>
        </div>
        {project.description && (
          <p className="mb-3 text-sm text-muted-foreground">{project.description}</p>
        )}

        {/* Owner agent */}
        {project.owner_agent && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
          >
            <User size={12} style={{ color: "var(--purple)", flexShrink: 0 }} />
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Owner:</span>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>
              {project.owner_agent.name}
            </span>
            <span style={{ color: "var(--border-light)" }}>·</span>
            <span>{project.owner_agent.role}</span>
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done} / {total} tasks complete
            </span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? "var(--green)" : "var(--cyan)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Tasks section */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
        >
          <ListChecks size={14} style={{ color: "var(--purple)" }} />
          <span className="text-sm font-semibold text-foreground">Tasks</span>
          {total > 0 && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
            >
              {total}
            </span>
          )}
        </div>

        {tasksPending ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No tasks yet. Create a project from a chat recommendation to generate tasks automatically.
          </div>
        ) : (
          <div>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
