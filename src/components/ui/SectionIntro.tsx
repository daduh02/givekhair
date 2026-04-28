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
      <div className="max-w-[42.5rem]">
        {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
        <h2 className="mt-4 text-[1.65rem] font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-[1.9rem] lg:text-[2.25rem]">
          {title}
        </h2>
        <p className="mt-4 max-w-[42.5rem] text-base leading-7 text-[color:var(--color-ink-soft)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
