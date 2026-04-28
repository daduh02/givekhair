export function AppealFallbackImage({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full w-full items-end overflow-hidden bg-[linear-gradient(145deg,rgba(204,251,241,0.95),rgba(248,245,239,0.98)_52%,rgba(255,255,255,0.98))] ${compact ? "p-4" : "p-6"}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(212,160,23,0.16),transparent_28%)]" />
      <div className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_10px_22px_rgba(15,118,110,0.22)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
        </svg>
      </div>
      <div className="relative max-w-[18rem]">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary-dark)]">
          GiveKhair Appeal
        </p>
        <p className={`mt-2 font-semibold tracking-[-0.03em] text-[color:var(--color-ink)] ${compact ? "text-base" : "text-xl"}`}>
          {title}
        </p>
      </div>
    </div>
  );
}
