"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckSquare,
  Circle,
  Loader2,
  ListChecks,
  User,
  Users,
  Activity,
  Zap,
  Eye,
  FlaskConical,
  Pen,
  Code2,
  TestTube2,
  Rocket,
  GitBranch,
  BookOpen,
  Package,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { projectApi, type ProjectBlueprint } from "@/lib/api/projects";
import { taskApi, type TaskApiResponse } from "@/lib/api/tasks";
import { executionApi, type ExecutionApiResponse } from "@/lib/api/executions";
import { ExecutionViewer } from "@/components/executions/ExecutionViewer";
import { useAuthStore } from "@/lib/store/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function execStatusColor(status: string): string {
  if (status === "completed") return "var(--green)";
  if (status === "running") return "var(--cyan)";
  if (status === "failed") return "var(--red)";
  if (status === "pending") return "var(--amber)";
  return "var(--faint)";
}

function latestFirst(execs: ExecutionApiResponse[]): ExecutionApiResponse[] {
  return [...execs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentStat {
  id: string;
  name: string;
  role: string;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

type ProjectPhase = "Research" | "Design" | "Development" | "Testing" | "Deployment";

const PHASE_ORDER: ProjectPhase[] = ["Research", "Design", "Development", "Testing", "Deployment"];

const PHASE_META: Record<ProjectPhase, { icon: React.ReactNode; bg: string; text: string; role: string }> = {
  Research:    { icon: <FlaskConical size={12} />, bg: "rgba(99,102,241,0.10)",  text: "#6366f1",          role: "Research Analyst" },
  Design:      { icon: <Pen size={12} />,          bg: "rgba(236,72,153,0.10)",  text: "#ec4899",          role: "UI/UX Designer" },
  Development: { icon: <Code2 size={12} />,        bg: "rgba(6,182,212,0.10)",   text: "var(--cyan)",      role: "Full Stack Engineer" },
  Testing:     { icon: <TestTube2 size={12} />,    bg: "rgba(245,158,11,0.10)",  text: "var(--amber)",     role: "QA Engineer" },
  Deployment:  { icon: <Rocket size={12} />,       bg: "rgba(16,185,129,0.10)",  text: "var(--green)",     role: "DevOps Engineer" },
};

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TaskApiResponse;
  executions: ExecutionApiResponse[];
  onExecute: (taskId: string, agentId: string) => void;
  onView: (executionId: string, taskTitle: string) => void;
  isExecuting: boolean;
}

function TaskRow({ task, executions, onExecute, onView, isExecuting }: TaskRowProps) {
  const done = task.status === "Done";
  const canExecute = !!task.assigned_to;
  const latestExecution = executions[0] ?? null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{ borderBottom: "1px solid var(--border-light)" }}
    >
      {statusIcon(task.status)}

      <span
        className="flex-1 min-w-0 text-sm"
        style={{
          color: done ? "var(--faint)" : "var(--foreground)",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {task.title}
      </span>

      {latestExecution && (
        <span
          className="shrink-0 hidden lg:flex items-center gap-1.5 text-[10px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Zap size={9} style={{ color: "var(--purple)" }} />
          {executions.length} run{executions.length !== 1 ? "s" : ""} ·{" "}
          {formatRelative(latestExecution.created_at)} ·{" "}
          <span style={{ color: execStatusColor(latestExecution.status) }}>
            {latestExecution.status}
          </span>
        </span>
      )}

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
        style={{ background: "rgba(0,0,0,0.12)", color: priorityColor(task.priority) }}
      >
        {task.priority}
      </span>

      <span
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
      >
        {task.status}
      </span>

      {canExecute && (
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => onExecute(task.id, task.assigned_to!)}
            disabled={isExecuting}
            title="Execute task"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--purple)" }}
          >
            {isExecuting ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <Zap size={9} />
            )}
            Execute
          </button>

          {latestExecution && (
            <button
              onClick={() => onView(latestExecution.id, task.title)}
              title="View latest output"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all hover:-translate-y-px"
              style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
            >
              <Eye size={9} />
              View
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentCard — Team section
// ---------------------------------------------------------------------------

function AgentCard({ stat, isLead = false }: { stat: AgentStat; isLead?: boolean }) {
  const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ background: "var(--purple)" }}
        >
          {stat.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{stat.name}</p>
            {isLead && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: "var(--accent-glow)", color: "var(--purple)" }}
              >
                Lead
              </span>
            )}
          </div>
          <p className="truncate text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {stat.role}
          </p>
        </div>
      </div>

      {/* Task counts */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg px-2.5 py-2 text-center"
          style={{ background: "var(--elevated)" }}
        >
          <p className="text-base font-bold text-foreground">{stat.total}</p>
          <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Assigned</p>
        </div>
        <div
          className="rounded-lg px-2.5 py-2 text-center"
          style={{ background: "rgba(16,185,129,0.08)" }}
        >
          <p className="text-base font-bold" style={{ color: "var(--green)" }}>{stat.completed}</p>
          <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Completed</p>
        </div>
      </div>

      {/* Health bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span>Progress</span>
          <span className="font-semibold text-foreground">{pct}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "var(--green)" : "var(--cyan)",
            }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-1.5">
        {stat.notStarted > 0 && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
          >
            {stat.notStarted} Not Started
          </span>
        )}
        {stat.inProgress > 0 && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(6,182,212,0.12)", color: "var(--cyan)" }}
          >
            {stat.inProgress} In Progress
          </span>
        )}
        {stat.completed > 0 && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}
          >
            {stat.completed} Completed
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blueprint + Prompt Pack components
// ---------------------------------------------------------------------------

const BLUEPRINT_SECTIONS: { key: keyof ProjectBlueprint; label: string }[] = [
  { key: "requirements", label: "Requirements" },
  { key: "features", label: "Features" },
  { key: "user_roles", label: "User Roles" },
  { key: "architecture", label: "Architecture" },
  { key: "database_design", label: "Database Design" },
  { key: "api_modules", label: "API Modules" },
  { key: "deployment_strategy", label: "Deployment Strategy" },
];

const PROMPT_PACK_ITEMS: { key: string; label: string }[] = [
  { key: "frontend", label: "Frontend Prompt" },
  { key: "backend", label: "Backend Prompt" },
  { key: "database", label: "Database Prompt" },
  { key: "testing", label: "Testing Prompt" },
  { key: "deployment", label: "Deployment Prompt" },
];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={doCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          doCopy(e);
        }
      }}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer"
      style={{
        background: copied ? "rgba(16,185,129,0.12)" : "var(--elevated)",
        color: copied ? "var(--green)" : "var(--muted-foreground)",
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </span>
  );
}

function CollapsibleSection({
  label,
  content,
  defaultOpen = false,
}: {
  label: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--border-light)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-[var(--elevated)]"
        style={{ color: "var(--foreground)" }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex-1">{label}</span>
      </button>
      {open && (
        <div
          className="px-4 pb-3 pt-1 text-xs leading-relaxed whitespace-pre-wrap"
          style={{
            color: "var(--muted-foreground)",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

function PromptSection({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--border-light)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left transition-colors hover:bg-[var(--elevated)]"
        style={{ color: "var(--foreground)" }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex-1">{label}</span>
        <CopyBtn text={content} />
      </button>
      {open && (
        <div
          className="px-4 pb-3 pt-1 text-xs leading-relaxed whitespace-pre-wrap"
          style={{
            color: "var(--muted-foreground)",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrgId } = useAuthStore();

  const [viewingExecution, setViewingExecution] = useState<{
    id: string;
    taskTitle: string;
  } | null>(null);

  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

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

  const executionsByTask = useQuery({
    queryKey: ["project-executions", id, tasks.map((t) => t.id).join(",")],
    queryFn: async () => {
      if (tasks.length === 0) return {} as Record<string, ExecutionApiResponse[]>;
      const results = await Promise.all(
        tasks
          .filter((t) => !!t.assigned_to)
          .map((t) =>
            executionApi.list({ task_id: t.id, limit: 10 }).then((execs) => ({
              taskId: t.id,
              execs,
            }))
          )
      );
      return Object.fromEntries(results.map((r) => [r.taskId, r.execs]));
    },
    enabled: tasks.length > 0,
    staleTime: 30_000,
  });

  // Group tasks by phase — tasks without a phase go into an unphased bucket
  const tasksByPhase = useMemo(() => {
    const grouped: Partial<Record<ProjectPhase, TaskApiResponse[]>> = {};
    const unphased: TaskApiResponse[] = [];
    for (const task of tasks) {
      if (task.phase && (PHASE_ORDER as string[]).includes(task.phase)) {
        const ph = task.phase as ProjectPhase;
        if (!grouped[ph]) grouped[ph] = [];
        grouped[ph]!.push(task);
      } else {
        unphased.push(task);
      }
    }
    return { grouped, unphased };
  }, [tasks]);

  const hasPhases = Object.keys(tasksByPhase.grouped).length > 0;

  // Aggregate per-agent stats from task data — no extra API calls
  const agentStats = useMemo<AgentStat[]>(() => {
    const map = new Map<string, AgentStat>();
    for (const task of tasks) {
      if (!task.assigned_agent) continue;
      const { id: aid, name, role } = task.assigned_agent;
      if (!map.has(aid)) {
        map.set(aid, { id: aid, name, role, total: 0, completed: 0, inProgress: 0, notStarted: 0 });
      }
      const entry = map.get(aid)!;
      entry.total++;
      if (task.status === "Done") entry.completed++;
      else if (task.status === "In Progress") entry.inProgress++;
      else entry.notStarted++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tasks]);

  const executeMutation = useMutation({
    mutationFn: ({ taskId, agentId }: { taskId: string; agentId: string }) =>
      executionApi.execute(taskId, agentId),
    onSuccess: (result, { taskId }) => {
      setExecutingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ["project-executions", id] });
      const task = tasks.find((t) => t.id === taskId);
      setViewingExecution({ id: result.execution_id, taskTitle: task?.title ?? "Task" });
    },
    onError: () => setExecutingTaskId(null),
  });

  const handleExecute = (taskId: string, agentId: string) => {
    setExecutingTaskId(taskId);
    executeMutation.mutate({ taskId, agentId });
  };

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const totalRuns = Object.values(executionsByTask.data ?? {}).reduce(
    (sum, execs) => sum + execs.length,
    0
  );

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
          <div className="flex items-center gap-2">
            {totalRuns > 0 && (
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--accent-glow)", color: "var(--purple)" }}
              >
                <Zap size={10} />
                {totalRuns} execution{totalRuns !== 1 ? "s" : ""}
              </span>
            )}
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
        </div>

        {project.description && (
          <p className="mb-3 text-sm text-muted-foreground">{project.description}</p>
        )}

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
            <span>{done} / {total} tasks complete</span>
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
        className="mb-6 rounded-xl border overflow-hidden"
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
        ) : hasPhases ? (
          // Phase-grouped view
          <div>
            {PHASE_ORDER.filter((ph) => tasksByPhase.grouped[ph]).map((phase) => {
              const meta = PHASE_META[phase];
              const phaseTasks = tasksByPhase.grouped[phase]!;
              const phDone = phaseTasks.filter((t) => t.status === "Done").length;
              return (
                <div key={phase}>
                  {/* Phase header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ borderBottom: "1px solid var(--border-light)", background: "var(--elevated)" }}
                  >
                    <span
                      className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: meta.bg, color: meta.text }}
                    >
                      {meta.icon}
                      {phase} Phase
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--faint)" }}>
                      {meta.role}
                    </span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {phDone}/{phaseTasks.length}
                    </span>
                  </div>
                  {/* Phase tasks */}
                  {phaseTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      executions={executionsByTask.data?.[task.id] ?? []}
                      onExecute={handleExecute}
                      onView={(execId, taskTitle) => setViewingExecution({ id: execId, taskTitle })}
                      isExecuting={executingTaskId === task.id}
                    />
                  ))}
                </div>
              );
            })}
            {/* Unphased tasks (backward compat) */}
            {tasksByPhase.unphased.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 px-4 py-2"
                  style={{ borderBottom: "1px solid var(--border-light)", background: "var(--elevated)" }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
                    General
                  </span>
                </div>
                {tasksByPhase.unphased.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    executions={executionsByTask.data?.[task.id] ?? []}
                    onExecute={handleExecute}
                    onView={(execId, taskTitle) => setViewingExecution({ id: execId, taskTitle })}
                    isExecuting={executingTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Flat view (legacy tasks without phase)
          <div>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                executions={executionsByTask.data?.[task.id] ?? []}
                onExecute={handleExecute}
                onView={(execId, taskTitle) => setViewingExecution({ id: execId, taskTitle })}
                isExecuting={executingTaskId === task.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project Blueprint */}
      {project.blueprint && (
        <div
          className="mb-6 rounded-xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
          >
            <BookOpen size={14} style={{ color: "var(--purple)" }} />
            <span className="text-sm font-semibold text-foreground">Project Blueprint</span>
          </div>
          <div className="p-4 space-y-2">
            {BLUEPRINT_SECTIONS.filter(({ key }) => {
              const val = project.blueprint![key as keyof ProjectBlueprint];
              return val && typeof val === "string";
            }).map(({ key, label }) => (
              <CollapsibleSection
                key={key}
                label={label}
                content={project.blueprint![key as keyof ProjectBlueprint] as string}
                defaultOpen={key === "requirements"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prompt Pack */}
      {project.blueprint?.prompt_pack && (
        <div
          className="mb-6 rounded-xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
          >
            <Package size={14} style={{ color: "var(--purple)" }} />
            <span className="text-sm font-semibold text-foreground">Prompt Pack</span>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
            >
              {PROMPT_PACK_ITEMS.filter(({ key }) =>
                (project.blueprint!.prompt_pack as Record<string, string | undefined>)[key]
              ).length} prompts
            </span>
          </div>
          <div className="p-4 space-y-2">
            {PROMPT_PACK_ITEMS.filter(({ key }) =>
              (project.blueprint!.prompt_pack as Record<string, string | undefined>)[key]
            ).map(({ key, label }) => (
              <PromptSection
                key={key}
                label={label}
                content={(project.blueprint!.prompt_pack as Record<string, string>)[key]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Team section — only rendered once tasks are loaded and agents are assigned */}
      {!tasksPending && agentStats.length > 0 && (
        <div className="mb-6">
          {/* Team Overview summary */}
          <div
            className="mb-4 rounded-xl border p-4"
            style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Users size={14} style={{ color: "var(--purple)" }} />
              <span className="text-sm font-semibold text-foreground">Team Overview</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: "var(--elevated)" }}
              >
                <p className="text-base font-bold text-foreground">{agentStats.length}</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  Collaborators
                </p>
              </div>
              <div
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: "var(--elevated)" }}
              >
                <p className="text-base font-bold text-foreground">{total}</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  Total Tasks
                </p>
              </div>
              <div
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: "var(--elevated)" }}
              >
                <p className="text-base font-bold" style={{ color: "var(--green)" }}>{done}</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  Completed
                </p>
              </div>
            </div>

            {/* Per-agent task count row */}
            <div className="mt-3 flex flex-wrap gap-2">
              {agentStats.map((stat) => {
                const isLead = project.owner_agent?.id === stat.id;
                return (
                  <span
                    key={stat.id}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                    style={{
                      background: isLead ? "var(--accent-glow)" : "var(--elevated)",
                      color: isLead ? "var(--purple)" : "var(--muted-foreground)",
                    }}
                    title={stat.role}
                  >
                    {isLead && <span className="font-bold">★</span>}
                    {stat.name}
                    <span
                      className="ml-1 rounded-full px-1.5 py-0.5"
                      style={{
                        background: isLead ? "rgba(124,58,237,0.2)" : "var(--border)",
                        color: isLead ? "var(--purple)" : "var(--foreground)",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      {stat.total}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Lead agent card */}
          {project.owner_agent && agentStats.some((s) => s.id === project.owner_agent!.id) && (
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <User size={12} style={{ color: "var(--purple)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Lead Agent
                </span>
              </div>
              <div className="grid gap-3">
                {agentStats
                  .filter((s) => s.id === project.owner_agent!.id)
                  .map((stat) => (
                    <AgentCard key={stat.id} stat={stat} isLead />
                  ))}
              </div>
            </div>
          )}

          {/* Collaborating agents */}
          {agentStats.filter((s) => s.id !== project.owner_agent?.id).length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Users size={12} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Collaborating Agents
                  <span
                    className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--elevated)" }}
                  >
                    {agentStats.filter((s) => s.id !== project.owner_agent?.id).length}
                  </span>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {agentStats
                  .filter((s) => s.id !== project.owner_agent?.id)
                  .map((stat) => (
                    <AgentCard key={stat.id} stat={stat} />
                  ))}
              </div>
            </div>
          )}

          {/* Fallback: no owner_agent set — show all agents together */}
          {!project.owner_agent && (
            <div className="grid gap-3 sm:grid-cols-2">
              {agentStats.map((stat) => (
                <AgentCard key={stat.id} stat={stat} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project Health — status breakdown grouped by agent */}
      {!tasksPending && agentStats.length > 0 && (
        <div
          className="mb-6 rounded-xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
          >
            <Activity size={14} style={{ color: "var(--purple)" }} />
            <span className="text-sm font-semibold text-foreground">Project Health</span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {agentStats.map((stat) => {
              const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
              return (
                <div key={stat.id} className="flex items-center gap-4 px-4 py-3">
                  {/* Agent label */}
                  <div className="w-32 shrink-0">
                    <p className="truncate text-xs font-semibold text-foreground">{stat.name}</p>
                    <p className="truncate text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {stat.role}
                    </p>
                  </div>

                  {/* Stacked health bar */}
                  <div className="flex flex-1 overflow-hidden rounded-full h-2 gap-px">
                    {stat.completed > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(stat.completed / stat.total) * 100}%`,
                          background: "var(--green)",
                        }}
                        title={`${stat.completed} completed`}
                      />
                    )}
                    {stat.inProgress > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(stat.inProgress / stat.total) * 100}%`,
                          background: "var(--cyan)",
                        }}
                        title={`${stat.inProgress} in progress`}
                      />
                    )}
                    {stat.notStarted > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(stat.notStarted / stat.total) * 100}%`,
                          background: "var(--border)",
                        }}
                        title={`${stat.notStarted} not started`}
                      />
                    )}
                  </div>

                  {/* Percentage */}
                  <span
                    className="w-9 shrink-0 text-right text-xs font-semibold"
                    style={{ color: pct === 100 ? "var(--green)" : "var(--foreground)" }}
                  >
                    {pct}%
                  </span>

                  {/* Legend chips */}
                  <div className="hidden sm:flex shrink-0 gap-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
                    >
                      {stat.notStarted} NS
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "rgba(6,182,212,0.12)", color: "var(--cyan)" }}
                    >
                      {stat.inProgress} IP
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}
                    >
                      {stat.completed} Done
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend footer */}
          <div
            className="flex items-center gap-4 px-4 py-2.5 text-[10px]"
            style={{ borderTop: "1px solid var(--border-light)", color: "var(--muted-foreground)" }}
          >
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--green)" }} />
              Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--cyan)" }} />
              In Progress
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--border)" }} />
              Not Started
            </span>
          </div>
        </div>
      )}

      {/* Agent Collaboration Timeline */}
      {!tasksPending && agentStats.length > 0 && (
        <div
          className="mb-6 rounded-xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
          >
            <GitBranch size={14} style={{ color: "var(--purple)" }} />
            <span className="text-sm font-semibold text-foreground">Agent Collaboration Timeline</span>
          </div>

          <div className="p-4 relative flex flex-col gap-3">
            {/* Vertical connector line */}
            <div
              className="absolute top-8 bottom-8"
              style={{ left: "2rem", width: "1px", background: "var(--border-light)" }}
            />

            {agentStats.map((stat) => (
              <div key={stat.id} className="relative flex items-center gap-3">
                {/* Avatar dot on the timeline */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white z-10"
                  style={{ background: "var(--purple)" }}
                >
                  {stat.name.charAt(0).toUpperCase()}
                </div>

                {/* Card */}
                <div
                  className="flex flex-1 min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5"
                  style={{ background: "var(--elevated)", borderColor: "var(--border-light)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{stat.name}</p>
                    <p className="truncate text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {stat.role}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}
                    >
                      {stat.completed} Done
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "rgba(6,182,212,0.12)", color: "var(--cyan)" }}
                    >
                      {stat.inProgress} Active
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
                    >
                      {stat.notStarted} Pending
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution History */}
      {!tasksPending && totalRuns > 0 && (
        <div
          className="mb-6 rounded-xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}
          >
            <Zap size={14} style={{ color: "var(--purple)" }} />
            <span className="text-sm font-semibold text-foreground">Execution History</span>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--elevated)", color: "var(--muted-foreground)" }}
            >
              {totalRuns} total
            </span>
          </div>

          {/* Column headers */}
          <div
            className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: "1fr 120px 48px 80px 72px",
              color: "var(--muted-foreground)",
              borderBottom: "1px solid var(--border-light)",
              background: "var(--elevated)",
            }}
          >
            <span>Task</span>
            <span>Agent</span>
            <span className="text-center">Runs</span>
            <span className="text-right">Last Run</span>
            <span className="text-right">Status</span>
          </div>

          <div>
            {tasks
              .filter((t) => (executionsByTask.data?.[t.id]?.length ?? 0) > 0)
              .map((task) => {
                const execs = latestFirst(executionsByTask.data![task.id]);
                const latest = execs[0];
                return (
                  <div
                    key={task.id}
                    className="grid items-center px-4 py-2.5 text-xs"
                    style={{
                      gridTemplateColumns: "1fr 120px 48px 80px 72px",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <span
                      className="truncate font-medium pr-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      {task.title}
                    </span>
                    <span
                      className="truncate pr-3"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {task.assigned_agent?.name ?? "—"}
                    </span>
                    <span
                      className="text-center font-semibold tabular-nums"
                      style={{ color: "var(--foreground)" }}
                    >
                      {execs.length}
                    </span>
                    <span
                      className="text-right tabular-nums"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatRelative(latest.created_at)}
                    </span>
                    <span
                      className="text-right font-semibold capitalize"
                      style={{ color: execStatusColor(latest.status) }}
                    >
                      {latest.status}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {viewingExecution && (
        <ExecutionViewer
          executionId={viewingExecution.id}
          taskTitle={viewingExecution.taskTitle}
          onClose={() => setViewingExecution(null)}
        />
      )}
    </div>
  );
}
