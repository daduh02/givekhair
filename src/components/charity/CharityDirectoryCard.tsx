import Image from "next/image";
import Link from "next/link";
import { TrustChip } from "@/components/ui/TrustChip";

interface CharityDirectoryCardProps {
  charity: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    defaultCurrency: string;
    shortDescription: string | null;
    charityNumber: string | null;
    isVerified: boolean;
    verificationStatus: string;
    appeals: Array<{
      id: string;
      slug: string;
      title: string;
    }>;
    _count: {
      appeals: number;
    };
    raisedTotal: number;
    fundraiserCount: number;
  };
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CharityDirectoryCard({ charity }: CharityDirectoryCardProps) {
  return (
    <article className="surface-card flex h-full flex-col overflow-hidden p-7 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-[1.4rem] border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
            {charity.logoUrl ? (
              <Image src={charity.logoUrl} alt={charity.name} fill className="object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[color:var(--color-primary-soft)] text-lg font-bold text-[color:var(--color-primary-dark)]">
                {charity.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{charity.name}</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
              {charity.charityNumber ? `Charity no. ${charity.charityNumber}` : "Public charity profile"}
            </p>
          </div>
        </div>

        {charity.isVerified ? <TrustChip tone="gold">Verified</TrustChip> : <TrustChip>{charity.verificationStatus}</TrustChip>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <TrustChip>{charity.defaultCurrency}</TrustChip>
        <TrustChip>{charity._count.appeals} appeals</TrustChip>
        <TrustChip>{charity.fundraiserCount} fundraisers</TrustChip>
      </div>

      <p className="mt-5 text-sm leading-7 text-[color:var(--color-ink-soft)]">
        {charity.shortDescription || "This charity profile is being expanded with clearer governance, impact, and campaign details for donors."}
      </p>

      {/* The metrics row gives the directory card stronger decision-making value
          than a simple logo wall, without forcing donors to open every profile. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.3rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.92)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Raised</p>
          <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-[color:var(--color-primary-dark)]">
            {formatCurrency(charity.raisedTotal, charity.defaultCurrency)}
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.92)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Live campaigns</p>
          <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{charity.appeals.length}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Active appeals</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {charity.appeals.length > 0 ? (
            charity.appeals.map((appeal) => (
              <Link
                key={appeal.id}
                href={`/appeals/${appeal.slug}`}
                className="trust-chip bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary-dark)]"
              >
                {appeal.title}
              </Link>
            ))
          ) : (
            <span className="text-sm text-[color:var(--color-ink-muted)]">No public appeals yet.</span>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/charities/${charity.slug}`} className="btn-primary">
          View charity profile
        </Link>
        {charity.websiteUrl ? (
          <a href={charity.websiteUrl} target="_blank" rel="noreferrer" className="btn-secondary">
            Visit website
          </a>
        ) : null}
      </div>
    </article>
  );
}
