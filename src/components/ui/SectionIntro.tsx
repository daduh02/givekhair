import type { ReactNode } from "react";

interface SectionIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function SectionIntro({ eyebrow, title, description, actions }: SectionIntroProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
        <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-base leading-8 text-[color:var(--color-ink-soft)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
