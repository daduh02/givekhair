import Image from "next/image";
import Link from "next/link";

interface Props {
  appeal: {
    id: string;
    slug: string;
    title: string;
    goalAmount: string | number;
    currency: string;
    bannerUrl?: string | null;
    charity: { name: string; logoUrl?: string | null; isVerified: boolean };
    _count?: { fundraisingPages: number };
  };
  raisedAmount?: number;
}

function fmt(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function AppealCard({ appeal, raisedAmount = 0 }: Props) {
  const goal = typeof appeal.goalAmount === "string" ? parseFloat(appeal.goalAmount) : appeal.goalAmount;
  const pct = goal > 0 ? Math.min(Math.round((raisedAmount / goal) * 100), 100) : 0;

  return (
    <Link href={`/appeals/${appeal.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "0 4px 24px rgba(18,78,64,0.08)", border: "1px solid rgba(18,78,64,0.08)" }}>

      {/* Banner */}
      <div className="relative h-36 flex items-center justify-center text-4xl"
        style={{ background: "linear-gradient(135deg,#D4EDE5,#F6F1E8)" }}>
        {appeal.bannerUrl
          ? (
            <Image
              src={appeal.bannerUrl}
              alt={appeal.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          )
          : <span>🌿</span>}
        {appeal.charity.isVerified && (
          <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: "white", color: "#124E40" }}>✓ Verified</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs mb-1" style={{ color: "#3A4A42" }}>{appeal.charity.name}</p>
        <h3 className="flex-1 text-sm font-semibold mb-3 line-clamp-2" style={{ color: "#233029" }}>
          {appeal.title}
        </h3>

        <div className="progress-bar mb-1.5">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold" style={{ color: "#1E8C6E" }}>{fmt(raisedAmount, appeal.currency)}</span>
          <span style={{ color: "#3A4A42" }}>{pct}% of {fmt(goal, appeal.currency)}</span>
        </div>

        {appeal._count && (
          <p className="mt-2 text-xs" style={{ color: "#8A9E94" }}>
            {appeal._count.fundraisingPages} fundraiser{appeal._count.fundraisingPages !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
