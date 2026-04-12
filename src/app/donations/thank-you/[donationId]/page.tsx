import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Thank you for your donation" };

function fmt(amount: string | number, currency = "GBP") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function DonationThankYouPage({
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

  const donorPays = donation.feeSet?.donorCoversFees
    ? parseFloat(donation.amount.toString()) + parseFloat(donation.feeSet.totalFees.toString())
    : parseFloat(donation.amount.toString());

  return (
    <div className="min-h-screen px-6 py-12" style={{ background: "linear-gradient(180deg, #F7F1E7 0%, #FFFDF8 100%)" }}>
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(18,78,64,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "#1E8C6E" }}>
          Donation complete
        </p>
        <h1 className="mt-3 text-3xl font-semibold" style={{ color: "#233029" }}>
          Thank you for supporting {donation.page.appeal.charity.name}
        </h1>
        <p className="mt-3 text-sm" style={{ color: "#6D7D75" }}>
          Your donation has been recorded and the appeal totals have been updated. {donation.donorEmail ? "A receipt has been marked as issued for this donation." : "No receipt email was provided for this donation."}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <SummaryCard label="Appeal" value={donation.page.appeal.title} />
          <SummaryCard label="Fundraiser page" value={donation.page.title} />
          <SummaryCard label="Donation amount" value={fmt(donation.amount.toString(), donation.currency)} />
          <SummaryCard label="Total paid" value={fmt(donorPays, donation.currency)} />
          <SummaryCard label="Gift Aid" value={donation.giftAidDeclaration ? "Declared" : "Not declared"} />
          <SummaryCard label="Status" value={donation.status} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/appeals/${donation.page.appeal.slug}`} className="btn-primary" style={{ padding: "0.8rem 1.2rem" }}>
            Back to appeal
          </Link>
          <Link href="/" className="btn-outline" style={{ padding: "0.8rem 1.2rem" }}>
            Return home
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
