"use client";

import { useMemo, useState } from "react";
import type { Metadata } from "next";
import { agentsData } from "@/lib/data/agents";
import { SearchBar } from "@/components/agents/SearchBar";
import { FilterBar } from "@/components/agents/FilterBar";
import { AgentTable } from "@/components/agents/AgentTable";

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
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by agent name or role..."
          />
        </div>
        <div className="flex shrink-0 gap-3">
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
        <div
          className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border-light)",
          }}
        >
          <p className="text-sm text-muted-foreground">
            No agents found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
}
