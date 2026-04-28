import Image from "next/image";
import Link from "next/link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrustChip } from "@/components/ui/TrustChip";
import { AppealFallbackImage } from "@/components/ui/AppealFallbackImage";

export interface AppealCardAppeal {
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
}

interface AppealCardProps {
  appeal: AppealCardAppeal;
  raisedAmount?: number;
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function AppealCard({ appeal, raisedAmount = 0 }: AppealCardProps) {
  const goal = typeof appeal.goalAmount === "string" ? parseFloat(appeal.goalAmount) : appeal.goalAmount;
  const progress = goal > 0 ? Math.min(Math.round((raisedAmount / goal) * 100), 100) : 0;

  return (
    <Link
      href={`/appeals/${appeal.slug}`}
      className="group surface-card flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {appeal.bannerUrl ? (
          <Image src={appeal.bannerUrl} alt={appeal.title} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <AppealFallbackImage title={appeal.title} compact />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {appeal.charity.isVerified ? <TrustChip tone="gold">Verified</TrustChip> : null}
          <TrustChip>{appeal.charity.name}</TrustChip>
        </div>

        <h3 className="mt-4 text-[1.35rem] font-bold tracking-[-0.04em] text-[color:var(--color-ink)] transition-colors group-hover:text-[color:var(--color-primary-dark)]">
          {appeal.title}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          {formatCurrency(raisedAmount, appeal.currency)} raised of {formatCurrency(goal, appeal.currency)}
        </p>

        <div className="mt-5">
          <ProgressBar value={progress} label="Raised" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <p className="text-[1.65rem] font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">
            {formatCurrency(raisedAmount, appeal.currency)}
          </p>
          <p className="text-sm font-semibold text-[color:var(--color-ink-soft)]">{progress}% of goal</p>
        </div>

        <div className="mt-5">
          {/* This is styled as a CTA rather than nested button markup so the
              whole card remains one accessible link target. */}
          <span className="btn-primary w-full">Donate now</span>
        </div>
      </div>
    </Link>
  );
}
