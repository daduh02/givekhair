import { randomUUID } from "crypto";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { markDonationCaptured, markDonationFailed } from "@/server/lib/donation-processing";

export const metadata: Metadata = { title: "Test hosted checkout" };

function fmt(amount: string | number, currency = "GBP") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default async function TestCheckoutPage({ params }: { params: { donationId: string } }) {
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

  const donationRecord = donation;

  async function completeCheckout() {
    "use server";
    await markDonationCaptured({
      donationId: donationRecord.id,
      provider: donationRecord.isRecurring ? "test-recurring" : "test-hosted-checkout",
      providerRef: `test_pi_${randomUUID().slice(0, 10)}`,
    });
    redirect(`/donations/thank-you/${donationRecord.id}`);
  }

  async function failCheckout() {
    "use server";
    await markDonationFailed({
      donationId: donationRecord.id,
      providerRef: `test_fail_${randomUUID().slice(0, 10)}`,
      failureReason: "Test checkout marked as failed.",
    });
    redirect(`/appeals/${donationRecord.page.appeal.slug}?checkout=failed`);
  }

  const donorPays = donationRecord.feeSet?.donorCoversFees
    ? parseFloat(donationRecord.amount.toString()) + parseFloat(donationRecord.feeSet.totalFees.toString())
    : parseFloat(donationRecord.amount.toString());

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-4xl surface-card p-8 sm:p-10">
          <span className="section-kicker">Hosted checkout test mode</span>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">
            {donation.page.appeal.charity.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--color-ink-soft)]">
            This page simulates the hosted payment provider while keeping the rest of the donation lifecycle real for development and QA.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <SummaryCard label="Fundraiser page" value={donationRecord.page.title} />
            <SummaryCard label="Appeal" value={donationRecord.page.appeal.title} />
            <SummaryCard label="Donation amount" value={fmt(donationRecord.amount.toString(), donationRecord.currency)} />
            <SummaryCard label="Donor pays" value={fmt(donorPays, donationRecord.currency)} />
            <SummaryCard label="Fees snapshot" value={fmt(donationRecord.feeSet?.totalFees.toString() ?? "0", donationRecord.currency)} />
            <SummaryCard label="Charity receives" value={fmt(donationRecord.feeSet?.netToCharity.toString() ?? donationRecord.amount.toString(), donationRecord.currency)} />
          </div>

          <div className="surface-muted mt-6 p-5">
            <div className="grid gap-3 text-sm text-[color:var(--color-ink-soft)] md:grid-cols-2">
              <p><strong>Donor:</strong> {donationRecord.donorName ?? "Anonymous donor"}</p>
              <p><strong>Email:</strong> {donationRecord.donorEmail ?? "No receipt email"}</p>
              <p><strong>Recurring:</strong> {donationRecord.isRecurring ? "Yes" : "No"}</p>
              <p><strong>Gift Aid:</strong> {donationRecord.giftAidDeclaration ? "Declared" : "Not declared"}</p>
              <p><strong>Cover fees:</strong> {donationRecord.feeSet?.donorCoversFees ? "Yes" : "No"}</p>
              <p><strong>Status:</strong> {donationRecord.status}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {donationRecord.status === "CAPTURED" ? (
              <Link href={`/donations/thank-you/${donationRecord.id}`} className="btn-primary">View thank-you page</Link>
            ) : (
              <form action={completeCheckout}>
                <button type="submit" className="btn-primary">Complete test payment</button>
              </form>
            )}

            {donationRecord.status !== "CAPTURED" ? (
              <form action={failCheckout}>
                <button type="submit" className="btn-secondary">Simulate payment failure</button>
              </form>
            ) : null}

            <Link href={`/appeals/${donationRecord.page.appeal.slug}`} className="btn-secondary">Back to appeal</Link>
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
