import type { TrendDataPoint } from "@/lib/api/analytics";

interface TaskCompletionTrendChartProps {
  data: TrendDataPoint[];
  isLoading?: boolean;
}

export function TaskCompletionTrendChart({
  data,
  isLoading,
}: TaskCompletionTrendChartProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-lg border p-6 min-h-[300px] animate-pulse"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
        }}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 flex items-center justify-center min-h-[300px]"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
        }}
      >
        <p className="text-sm text-muted-foreground">No trend data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.created, d.completed]), 1);
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = 40;

  const toPoint = (value: number, index: number) => ({
    x: (index / (data.length - 1 || 1)) * (chartWidth - padding * 2) + padding,
    y: 20 + (1 - value / maxValue) * (chartHeight - padding),
    value,
  });

  const pointsCreated = data.map((d, i) => toPoint(d.created, i));
  const pointsCompleted = data.map((d, i) => toPoint(d.completed, i));

  const buildPath = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div
      className="rounded-lg border p-6"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Task Completion Trend
      </h3>
      <div className="flex flex-col">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
          className="w-full"
          style={{ minHeight: "300px" }}
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`grid-${i}`}
              x1={padding}
              y1={20 + (i * (chartHeight - padding)) / 4}
              x2={chartWidth - padding}
              y2={20 + (i * (chartHeight - padding)) / 4}
              stroke="var(--border-light)"
              strokeDasharray="4"
              opacity="0.5"
            />
          ))}

          {/* Created line (dashed, muted) */}
          <path
            d={buildPath(pointsCreated)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="2"
            strokeDasharray="5 3"
            opacity="0.6"
          />

          {/* Completed line */}
          <path
            d={buildPath(pointsCompleted)}
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="3"
          />

          {/* Dots for completed */}
          {pointsCompleted.map((p, i) => (
            <circle
              key={`c-${i}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--cyan)"
            />
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text
              key={`lx-${i}`}
              x={
                (i / (data.length - 1 || 1)) * (chartWidth - padding * 2) +
                padding
              }
              y={chartHeight + 35}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {d.date}
            </text>
          ))}

          {/* Y-axis labels */}
          {[0, 1, 2, 3, 4].map((i) => (
            <text
              key={`ly-${i}`}
              x={padding - 10}
              y={20 + (i * (chartHeight - padding)) / 4 + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {Math.round(maxValue - (maxValue * i) / 4)}
            </text>
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-4 flex gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-6 rounded"
              style={{ background: "var(--cyan)" }}
            />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-px w-6"
              style={{
                background: "var(--muted-foreground)",
                opacity: 0.6,
                borderTop: "2px dashed var(--muted-foreground)",
              }}
            />
            <span className="text-xs text-muted-foreground">Created</span>
          </div>
        </div>
      </div>
    </div>
  );
}
