"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { projectsData } from "@/lib/data/projects";
import { projectApi, type ProjectApiResponse } from "@/lib/api/projects";
import { useAuthStore } from "@/lib/store/auth";
import { ProjectSearchBar } from "@/components/projects/ProjectSearchBar";
import { ProjectFilterBar } from "@/components/projects/ProjectFilterBar";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import type { Project } from "@/lib/data/projects";

// Backend status → component status
function mapProjectStatus(s: string): "Active" | "On Hold" | "Completed" {
  if (s === "Active") return "Active";
  if (s === "Completed") return "Completed";
  return "On Hold"; // Planning / Archived
}

function toDisplayProject(p: ProjectApiResponse): Project {
  return {
    id: p.id,
    title: p.name,
    description: p.description ?? "",
    status: mapProjectStatus(p.status),
    progress: p.progress,
    agentCount: 0,
    agents: [],
    startDate: p.created_at,
    dueDate: p.updated_at,
    priority: "Medium",
  };
}

export default function ProjectsPage() {
  const { user, currentOrgId } = useAuthStore();
  const isGuest = user?.isGuest ?? true;

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const {
    data: apiProjects,
    isPending,
    error,
  } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: !isGuest && !!currentOrgId,
  });

  const rawProjects: Project[] = isGuest
    ? projectsData
    : (apiProjects ?? []).map(toDisplayProject);

  const filteredProjects = useMemo(
    () =>
      rawProjects.filter((project) => {
        const matchesSearch =
          project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          !selectedStatus || project.status === selectedStatus;
        return matchesSearch && matchesStatus;
      }),
    [rawProjects, searchQuery, selectedStatus]
  );

  const handleReset = () => {
    setSearchQuery("");
    setSelectedStatus("");
  };

  const stats = {
    total: rawProjects.length,
    active: rawProjects.filter((p) => p.status === "Active").length,
    completed: rawProjects.filter((p) => p.status === "Completed").length,
  };
  const avgProgress =
    rawProjects.length > 0
      ? Math.round(
          rawProjects.reduce((sum, p) => sum + p.progress, 0) /
            rawProjects.length
        )
      : 0;

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Organize and track your AI-powered projects and their progress.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      {!isGuest && !currentOrgId && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No organisation found. Create one in Settings to manage projects.
        </div>
      )}

      {!isGuest && error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load projects. Please try again.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Projects" value={stats.total} />
        <SummaryCard label="Active" value={stats.active} tone="cyan" />
        <SummaryCard label="Completed" value={stats.completed} tone="green" />
        <SummaryCard label="Avg Progress" value={`${avgProgress}%`} />
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <ProjectSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by project title or description..."
          />
        </div>
        <div className="shrink-0">
          <ProjectFilterBar
            status={selectedStatus}
            onStatusChange={setSelectedStatus}
            onReset={handleReset}
          />
        </div>
      </div>

      {isPending && !isGuest ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading projects…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold">{filteredProjects.length}</span>{" "}
              of{" "}
              <span className="font-semibold">{rawProjects.length}</span>{" "}
              projects
            </p>
          </div>
          <ProjectGrid projects={filteredProjects} />
        </>
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
