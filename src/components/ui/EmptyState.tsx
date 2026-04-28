import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card p-6 sm:p-8">
      <div className="max-w-2xl">
        <p className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--color-ink)]">{title}</p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-muted)]">{description}</p>
        {action ? <div className="mt-5 flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </div>
  );
}
