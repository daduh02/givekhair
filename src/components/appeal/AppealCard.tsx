import Link from "next/link";
import Image from "next/image";

interface Props {
  appeal: {
    id: string;
    slug: string;
    title: string;
    goalAmount: string | number;
    currency: string;
    bannerUrl?: string | null;
    charity: {
      name: string;
      logoUrl?: string | null;
      isVerified: boolean;
    };
    _count?: { fundraisingPages: number };
  };
  raisedAmount?: number;
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function AppealCard({ appeal, raisedAmount = 0 }: Props) {
  const goal = typeof appeal.goalAmount === "string" ? parseFloat(appeal.goalAmount) : appeal.goalAmount;
  const pct = goal > 0 ? Math.min(Math.round((raisedAmount / goal) * 100), 100) : 0;

  return (
    <Link
      href={`/appeals/${appeal.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-green-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-green-500"
    >
      {/* Banner */}
      <div className="relative h-36 bg-green-100">
        {appeal.bannerUrl ? (
          <Image src={appeal.bannerUrl} alt={appeal.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🌿</div>
        )}
        {appeal.charity.isVerified && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-green-700">
            ✓ Verified
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-xs text-gray-500">{appeal.charity.name}</p>
        <h3 className="mb-3 flex-1 text-sm font-medium text-gray-900 group-hover:text-green-700 line-clamp-2">
          {appeal.title}
        </h3>

        {/* Progress */}
        <div className="progress-bar mb-1.5">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-green-700">{formatCurrency(raisedAmount, appeal.currency)}</span>
          <span className="text-gray-400">{pct}% of {formatCurrency(goal, appeal.currency)}</span>
        </div>

        {appeal._count && (
          <p className="mt-2 text-xs text-gray-400">
            {appeal._count.fundraisingPages} fundraiser{appeal._count.fundraisingPages !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
