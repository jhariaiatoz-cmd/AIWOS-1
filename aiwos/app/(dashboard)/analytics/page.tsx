"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/lib/store/auth";
import { analyticsApi } from "@/lib/api/analytics";
import { AnalyticsKPICard, KPICardSkeleton } from "@/components/analytics/AnalyticsKPICard";
import { TimeRangeSelector } from "@/components/analytics/TimeRangeSelector";
import { TaskCompletionTrendChart } from "@/components/analytics/TaskCompletionTrendChart";
import { TasksByDepartmentChart } from "@/components/analytics/TasksByDepartmentChart";

type TimeRange = "7d" | "30d" | "90d" | "1y";

function deriveTrend(changePct: number): "up" | "down" | "neutral" {
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "neutral";
}

function formatResponseTime(seconds: number): { value: string; unit: string } {
  if (seconds === 0) return { value: "—", unit: "" };
  if (seconds < 60) return { value: seconds.toFixed(1), unit: "s" };
  if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: "min" };
  return { value: (seconds / 3600).toFixed(1), unit: "hrs" };
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const { currentOrgId, user } = useAuthStore();
  const isAuthenticated = !user?.isGuest && !!currentOrgId;
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-metrics", currentOrgId, timeRange],
    queryFn: () => analyticsApi.metrics(currentOrgId!, timeRange),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const hasData = !!data;
  const responseTime = data ? formatResponseTime(data.avg_response_time_seconds) : null;

  // Response time trend: negative change = improved = show as "up" (green)
  const rtChangePct = data?.response_time_change_pct ?? 0;
  const rtTrend: "up" | "down" | "neutral" =
    rtChangePct < 0 ? "up" : rtChangePct > 0 ? "down" : "neutral";
  const rtTrendValue = Math.abs(rtChangePct);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance metrics and insights
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Not authenticated */}
      {!isAuthenticated && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-16 text-center"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <p className="text-sm font-medium text-foreground">
            Sign in to view live analytics
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time metrics will appear here once you sign in.
          </p>
        </div>
      )}

      {/* Error state */}
      {isAuthenticated && isError && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-16 text-center"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <p className="text-sm font-medium text-foreground">
            Failed to load analytics data
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your connection or refresh the page.
          </p>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["analytics-metrics", currentOrgId, timeRange],
              })
            }
            className="mt-4 rounded-lg px-4 py-2 text-xs font-medium text-foreground transition-colors"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
          >
            Try again
          </button>
        </div>
      )}

      {/* No data state */}
      {isAuthenticated && !isLoading && !isError && !hasData && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-16 text-center"
          style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
        >
          <p className="text-sm font-medium text-foreground">
            No analytics data available yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create tasks, run agents, and execute workflows to see metrics here.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      {isAuthenticated && (isLoading || hasData) && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {isLoading ? (
              <>
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
              </>
            ) : (
              <>
                <AnalyticsKPICard
                  title="Total Tasks"
                  value={data!.total_tasks}
                  trend={deriveTrend(data!.tasks_change_pct)}
                  trendValue={Math.abs(data!.tasks_change_pct)}
                />
                <AnalyticsKPICard
                  title="Completed Tasks"
                  value={data!.completed_tasks}
                  trend={deriveTrend(data!.completed_change_pct)}
                  trendValue={Math.abs(data!.completed_change_pct)}
                />
                <AnalyticsKPICard
                  title="Success Rate"
                  value={data!.success_rate.toFixed(1)}
                  unit="%"
                  trend={deriveTrend(data!.success_rate_change_pct)}
                  trendValue={Math.abs(data!.success_rate_change_pct)}
                />
                <AnalyticsKPICard
                  title="Avg Response Time"
                  value={responseTime!.value}
                  unit={responseTime!.unit}
                  trend={rtTrend}
                  trendValue={rtTrendValue}
                />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TaskCompletionTrendChart
                data={data?.task_completion_trend ?? []}
                isLoading={isLoading}
              />
            </div>
            <TasksByDepartmentChart
              data={data?.tasks_by_department ?? []}
              isLoading={isLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
