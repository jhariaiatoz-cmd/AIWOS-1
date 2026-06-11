interface SettingsEmptyPanelProps {
  title: string;
  description: string;
}

export function SettingsEmptyPanel({
  title,
  description,
}: SettingsEmptyPanelProps) {
  return (
    <div
      className="rounded-xl border p-8"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
