import { randomUUID } from "crypto";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { markDonationCaptured, markDonationFailed } from "@/server/lib/donation-processing";

export const metadata: Metadata = { title: "Test hosted checkout" };

function fmt(amount: string | number, currency = "GBP") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function TestCheckoutPage({
  params,
}: {
  params: { donationId: string };
}) {
  const donation = await db.donation.findUnique({
    where: { id: params.donationId },
    include: {
      feeSet: true,
      giftAidDeclaration: true,
      page: {
        include: {
          appeal: {
            include: {
              charity: true,
            },
          },
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
    <div className="min-h-screen px-6 py-12" style={{ background: "linear-gradient(180deg, #F7F1E7 0%, #FFFDF8 100%)" }}>
      <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(18,78,64,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "#1E8C6E" }}>
          Test hosted checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold" style={{ color: "#233029" }}>
          {donationRecord.page.appeal.charity.name}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6D7D75" }}>
          This simulates the hosted checkout provider while we keep the rest of the donation lifecycle real.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <SummaryCard label="Fundraiser page" value={donationRecord.page.title} />
          <SummaryCard label="Appeal" value={donationRecord.page.appeal.title} />
          <SummaryCard label="Donation amount" value={fmt(donationRecord.amount.toString(), donationRecord.currency)} />
          <SummaryCard label="Donor pays" value={fmt(donorPays, donationRecord.currency)} />
          <SummaryCard label="Fees snapshot" value={fmt(donationRecord.feeSet?.totalFees.toString() ?? "0", donationRecord.currency)} />
          <SummaryCard label="Charity receives" value={fmt(donationRecord.feeSet?.netToCharity.toString() ?? donationRecord.amount.toString(), donationRecord.currency)} />
        </div>

        <div className="mt-6 rounded-3xl border p-5" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}>
          <div className="grid gap-3 text-sm md:grid-cols-2" style={{ color: "#3A4A42" }}>
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
            <Link href={`/donations/thank-you/${donationRecord.id}`} className="btn-primary" style={{ padding: "0.8rem 1.2rem" }}>
              View thank-you page
            </Link>
          ) : (
            <form action={completeCheckout}>
              <button type="submit" className="btn-primary" style={{ padding: "0.8rem 1.2rem" }}>
                Complete test payment
              </button>
            </form>
          )}

          {donationRecord.status !== "CAPTURED" ? (
            <form action={failCheckout}>
              <button type="submit" className="btn-outline" style={{ padding: "0.8rem 1.2rem" }}>
                Simulate payment failure
              </button>
            </form>
          ) : null}

          <Link href={`/appeals/${donationRecord.page.appeal.slug}`} className="btn-outline" style={{ padding: "0.8rem 1.2rem" }}>
            Back to appeal
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl p-5" style={{ background: "#F8F5EE" }}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#8A9E94" }}>
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold" style={{ color: "#233029" }}>
        {value}
      </p>
    </div>
  );
}
