interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border px-6 text-center"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
      role="status"
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
