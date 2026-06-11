interface SummaryCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "cyan" | "green" | "amber" | "red";
}

const toneColor = {
  default: "var(--foreground)",
  cyan: "var(--cyan)",
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
} satisfies Record<NonNullable<SummaryCardProps["tone"]>, string>;

export function SummaryCard({
  label,
  value,
  tone = "default",
}: SummaryCardProps) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="mt-1 text-2xl font-bold"
        style={{ color: toneColor[tone] }}
      >
        {value}
      </div>
    </div>
  );
}
