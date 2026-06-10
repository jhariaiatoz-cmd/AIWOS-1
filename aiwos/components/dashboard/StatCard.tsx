import {
  Bot,
  Play,
  CheckCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatCard as StatCardType } from "@/lib/types";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Bot,
  Play,
  CheckCircle,
  DollarSign,
};

interface Props {
  card: StatCardType;
}

export function StatCard({ card }: Props) {
  const Icon = ICONS[card.icon] ?? Bot;

  return (
    <div
      className="cursor-default rounded-xl border p-4 transition-colors hover:border-border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div
        className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Icon size={14} style={{ color: card.color }} />
        {card.label}
      </div>
      <div className="flex items-start justify-between">
        <div
          className="text-[26px] font-bold leading-tight text-foreground"
        >
          {card.value}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: card.bgColor, color: card.color }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div
        className={cn(
          "mt-1.5 flex items-center gap-1 text-[11px]",
          card.deltaType === "up" ? "text-[var(--green)]" : "text-[var(--red)]",
        )}
      >
        {card.deltaType === "up" ? (
          <TrendingUp size={12} />
        ) : (
          <TrendingDown size={12} />
        )}
        {card.delta}
      </div>
    </div>
  );
}
