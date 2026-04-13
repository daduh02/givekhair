import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Thank you for your donation" };

function fmt(amount: string | number, currency = "GBP") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default async function DonationThankYouPage({ params }: { params: { donationId: string } }) {
  const donation = await db.donation.findUnique({
    where: { id: params.donationId },
    include: {
      feeSet: true,
      giftAidDeclaration: true,
      page: {
        include: {
          appeal: { include: { charity: true } },
        },
      },
    },
  });

  if (!donation) {
    notFound();
  }

  const donorPays = parseFloat(
    donation.grossCheckoutTotal?.toString() ??
    (donation.feeSet?.donorCoversFees
      ? (parseFloat(donation.amount.toString()) + parseFloat(donation.feeSet.totalFees.toString())).toFixed(2)
      : donation.amount.toString())
  );
  const donationAmount = donation.donationAmount?.toString() ?? donation.amount.toString();

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-3xl surface-card p-8 sm:p-10">
          <span className="section-kicker">Donation complete</span>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">
            Thank you for supporting {donation.page.appeal.charity.name}
          </h1>
          <p className="mt-4 text-base leading-8 text-[color:var(--color-ink-soft)]">
            Your donation has been recorded and the appeal totals have been updated. {donation.donorEmail ? "A receipt has been marked as issued for this donation." : "No receipt email was provided for this donation."}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <SummaryCard label="Appeal" value={donation.page.appeal.title} />
            <SummaryCard label="Fundraiser page" value={donation.page.title} />
            <SummaryCard label="Donation amount" value={fmt(donationAmount, donation.currency)} />
            <SummaryCard label="Total paid" value={fmt(donorPays, donation.currency)} />
            <SummaryCard label="Charging mode" value={donation.resolvedChargingMode ?? (donation.feeSet?.donorCoversFees ? "DONOR_SUPPORTED" : "CHARITY_PAID")} />
            <SummaryCard label="Gift Aid" value={donation.giftAidDeclaration ? "Declared" : "Not declared"} />
            <SummaryCard label="Status" value={donation.status} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/appeals/${donation.page.appeal.slug}`} className="btn-primary">Back to appeal</Link>
            <Link href="/" className="btn-secondary">Return home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-3 text-xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{value}</p>
    </div>
  );
}
