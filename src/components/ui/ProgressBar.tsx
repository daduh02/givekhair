interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: "teal" | "gold";
  className?: string;
}

export function ProgressBar({ value, label, tone = "teal", className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fillStyle =
    tone === "gold"
      ? { background: "linear-gradient(90deg, var(--color-gold) 0%, #FACC15 100%)" }
      : undefined;

  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      ) : null}
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label ?? "Progress"}
      >
        {/* Inline width is still the cleanest way to express live progress without
            generating one-off utility classes for every percentage value. */}
        <div className="progress-fill" style={{ width: `${clamped}%`, ...fillStyle }} />
      </div>
    </div>
  );
}
