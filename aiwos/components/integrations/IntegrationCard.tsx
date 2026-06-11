import type { ReactNode } from "react";

export type IntegrationStatus = "connected" | "disconnected";

interface IntegrationCardProps {
  name: string;
  description: string;
  status: IntegrationStatus;
  logo: ReactNode;
  onToggle: () => void;
}

export function IntegrationCard({
  name,
  description,
  status,
  logo,
  onToggle,
}: IntegrationCardProps) {
  const isConnected = status === "connected";

  return (
    <div
      className="flex min-h-[136px] flex-col justify-between rounded-xl border p-4 transition-all duration-150 hover:border-[var(--border)]"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">{logo}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {name}
            </h3>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
              style={{
                background: isConnected
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(85,85,112,0.18)",
                color: isConnected ? "var(--green)" : "var(--muted-foreground)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: isConnected
                    ? "var(--green)"
                    : "var(--muted-foreground)",
                }}
              />
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 h-8 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-card"
        style={{
          borderColor: isConnected ? "rgba(239,68,68,0.35)" : "var(--border)",
          color: isConnected ? "var(--red)" : "var(--foreground)",
          background: isConnected ? "rgba(239,68,68,0.08)" : "var(--input-bg)",
        }}
      >
        {isConnected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}
