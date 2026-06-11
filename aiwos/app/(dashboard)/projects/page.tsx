"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { projectsData } from "@/lib/data/projects";
import { ProjectSearchBar } from "@/components/projects/ProjectSearchBar";
import { ProjectFilterBar } from "@/components/projects/ProjectFilterBar";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { SummaryCard } from "@/components/common/SummaryCard";

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const filteredProjects = useMemo(() => {
    return projectsData.filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        !selectedStatus || project.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  const handleReset = () => {
    setSearchQuery("");
    setSelectedStatus("");
  };

  // Calculate statistics
  const stats = {
    total: projectsData.length,
    active: projectsData.filter((p) => p.status === "Active").length,
    completed: projectsData.filter((p) => p.status === "Completed").length,
    onHold: projectsData.filter((p) => p.status === "On Hold").length,
  };

  const avgProgress = Math.round(
    projectsData.reduce((sum, p) => sum + p.progress, 0) / projectsData.length
  );

  return (
    <div className="min-h-full">
      {/* Page header with create button */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Organize and track your AI-powered projects and their progress.
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Projects" value={stats.total} />
        <SummaryCard label="Active" value={stats.active} tone="cyan" />
        <SummaryCard label="Completed" value={stats.completed} tone="green" />
        <SummaryCard label="Avg Progress" value={`${avgProgress}%`} />
      </div>

      {/* Controls */}
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

      {/* Results count */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold">{filteredProjects.length}</span>{" "}
          of <span className="font-semibold">{projectsData.length}</span> projects
        </p>
      </div>

      {/* Grid */}
      <ProjectGrid projects={filteredProjects} />
    </div>
  );
}
