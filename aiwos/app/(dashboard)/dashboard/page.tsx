import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CommandHero } from "@/components/dashboard/CommandHero";
import { StatCard } from "@/components/dashboard/StatCard";
import { DepartmentGrid } from "@/components/dashboard/DepartmentGrid";
import { TaskCompletionChart } from "@/components/dashboard/TaskCompletionChart";
import { TopAgents } from "@/components/dashboard/TopAgents";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { statCards } from "@/lib/data/dashboard";

export const metadata: Metadata = {
  title: "Dashboard — AIWOS",
};

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      {/* Command Hero */}
      <CommandHero />

      {/* Stat Cards */}
      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </div>

      {/* Department Overview */}
      <div className="mb-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">
            Department Overview
          </span>
          <Link
            href="/agents"
            className="flex items-center gap-1 text-xs transition-colors hover:underline"
            style={{ color: "var(--purple)" }}
          >
            View All <ChevronRight size={12} />
          </Link>
        </div>
        <DepartmentGrid />
      </div>

      {/* Bottom two-column layout: chart+agents | activity */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <TaskCompletionChart />
          <TopAgents />
        </div>

        {/* Right column */}
        <RecentActivities />
      </div>
    </div>
  );
}
