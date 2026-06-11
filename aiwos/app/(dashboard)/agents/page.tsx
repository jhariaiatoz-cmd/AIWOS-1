"use client";

import { useMemo, useState } from "react";
import { agentsData } from "@/lib/data/agents";
import { SearchBar } from "@/components/agents/SearchBar";
import { FilterBar } from "@/components/agents/FilterBar";
import { AgentTable } from "@/components/agents/AgentTable";
import { EmptyState } from "@/components/common/EmptyState";

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const filteredAgents = useMemo(() => {
    return agentsData.filter((agent) => {
      const matchesSearch =
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment =
        !selectedDepartment || agent.department === selectedDepartment;

      const matchesStatus =
        !selectedStatus || agent.status === selectedStatus;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [searchQuery, selectedDepartment, selectedStatus]);

  const handleReset = () => {
    setSearchQuery("");
    setSelectedDepartment("");
    setSelectedStatus("");
  };

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Manage and monitor your AI agents, their status, performance, and
          assignments.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by agent name or role..."
          />
        </div>
        <div className="shrink-0">
          <FilterBar
            department={selectedDepartment}
            status={selectedStatus}
            onDepartmentChange={setSelectedDepartment}
            onStatusChange={setSelectedStatus}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold">{filteredAgents.length}</span>{" "}
          of <span className="font-semibold">{agentsData.length}</span> agents
        </p>
      </div>

      {/* Table */}
      {filteredAgents.length > 0 ? (
        <AgentTable agents={filteredAgents} />
      ) : (
        <EmptyState title="No agents found" description="Try changing your search or filters." />
      )}
    </div>
  );
}
