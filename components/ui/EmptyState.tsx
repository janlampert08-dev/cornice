import type { ComponentType, ReactNode } from "react";

export default function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <Icon className="h-7 w-7 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">{title}</p>
      {action}
    </div>
  );
}
