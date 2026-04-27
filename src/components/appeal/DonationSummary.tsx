import React from "react";
import Link from "next/link";
import type { AppealDonationSummaryData } from "@/lib/appeal-donation-summary";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type DonationSummaryProps = {
  summary: AppealDonationSummaryData;
  loading?: boolean;
};

export function DonationSummary({ summary, loading = false }: DonationSummaryProps) {
  const cards = [
    { label: "Total", value: summary.total, hint: "All successful giving linked to this appeal" },
    { label: "Online", value: summary.online, hint: "Successful checkout donations" },
    { label: "Offline", value: summary.offline, hint: "Manual and CSV-imported donations" },
    { label: "Fundraisers", value: summary.fundraisers, hint: "Linked fundraiser-page donations" },
  ];

  return (
    <section className="surface-card p-7 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Donation summary</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Where support is coming from</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-ink-muted)]">
            A live breakdown of this appeal&apos;s online donations, fundraiser-driven support, and offline entries already recorded in GiveKhair.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[1.35rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">{card.label}</p>
            {loading ? (
              <div className="mt-3 h-9 animate-pulse rounded-xl bg-[rgba(15,23,42,0.06)]" />
            ) : (
              <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">
                {formatCurrency(card.value)}
              </p>
            )}
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-[color:var(--color-line)] bg-[rgba(248,245,239,0.72)] px-4 py-4 text-sm text-[color:var(--color-ink-soft)]">
        Charities pay a small fee for our service.{" "}
        <Link href="/fees" className="font-semibold text-[color:var(--color-primary-dark)] underline underline-offset-4">
          Learn more about fees
        </Link>
      </div>
    </section>
  );
}
