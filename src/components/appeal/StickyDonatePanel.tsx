import { ProgressBar } from "@/components/ui/ProgressBar";

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function StickyDonatePanel({
  amountRaised,
  goalAmount,
  currency,
  progress,
  supporterCount,
  fundraiserCount,
}: {
  amountRaised: number;
  goalAmount: number;
  currency: string;
  progress: number;
  supporterCount: number;
  fundraiserCount: number;
}) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-sm font-semibold text-[color:var(--color-ink-muted)]">Support this appeal</p>
      <p className="mt-3 text-[2.2rem] font-bold tracking-[-0.05em] text-[color:var(--color-primary-dark)]">
        {formatCurrency(amountRaised, currency)}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
        raised of {formatCurrency(goalAmount, currency)} goal. Includes approved offline donations.
      </p>

      <ProgressBar value={progress} label="Funded" className="mt-5" />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Supporters" value={String(supporterCount)} />
        <Metric label="Fundraisers" value={String(fundraiserCount)} />
        <Metric label="Funded" value={`${progress}%`} />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a href="#donation-checkout" className="btn-primary flex-1">
          Donate now
        </a>
        <a href="#share-this-cause" className="btn-outline flex-1">
          Share
        </a>
      </div>

      <p className="mt-4 text-xs leading-6 text-[color:var(--color-ink-muted)]">
        Give securely through GiveKhair&apos;s hosted flow, or share this appeal to help more people support it.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.92)] px-3 py-3">
      <p className="text-xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[color:var(--color-ink-muted)]">{label}</p>
    </div>
  );
}
