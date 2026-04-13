import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  decimalToNumber,
  formatCurrency,
  getFundraiserStateSummary,
  getGoalProgress,
  getStateToneStyles,
} from "@/lib/fundraiser-management";

export const metadata: Metadata = { title: "Dashboard" };

const ADMIN_ROLES = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];

function normalizeRole(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : "DONOR";
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "1rem",
        padding: "1.25rem",
        boxShadow: "0 2px 12px rgba(18,78,64,0.07)",
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>
        {value}
      </p>
      {subtext ? (
        <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "1rem",
        padding: "1.25rem",
        boxShadow: "0 2px 12px rgba(18,78,64,0.07)",
      }}
    >
      <h2 className="text-base font-semibold" style={{ color: "#233029" }}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6" style={{ color: "#3A4A42" }}>
        {description}
      </p>
      <Link href={href} className="btn-outline mt-4 inline-flex">
        {cta}
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin?callbackUrl=%2Fdashboard");
  }

  const user = session.user as { id?: string; role?: unknown; name?: string | null; email?: string | null } | undefined;
  const role = normalizeRole(user?.role);
  const isAdmin = ADMIN_ROLES.includes(role);

  const [appealCount, managedCharity, recentAppeals, myPagesBase] = await Promise.all([
    db.appeal.count({ where: { status: "ACTIVE", visibility: "PUBLIC" } }),
    isAdmin && user?.id
      ? db.charityAdmin.findFirst({
          where: { userId: user.id },
          include: { charity: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(null),
    db.appeal.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC" },
      select: {
        id: true,
        title: true,
        slug: true,
        goalAmount: true,
        currency: true,
        charity: { select: { name: true } },
        _count: { select: { fundraisingPages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    user?.id
      ? db.fundraisingPage.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            title: true,
            shortName: true,
            status: true,
            visibility: true,
            targetAmount: true,
            currency: true,
            appeal: { select: { title: true } },
            moderationItems: {
              orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: { reviewNotes: true },
            },
            _count: {
              select: {
                updates: true,
                mediaItems: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  /*
    The dashboard only needs a lightweight owner summary, so we reuse aggregate
    queries and enrich the existing page cards instead of adding a separate
    analytics subsystem.
  */
  const myPages = await Promise.all(
    myPagesBase.map(async (page) => {
      const [onlineAgg, offlineAgg, recentDonationsCount] = await Promise.all([
        db.donation.aggregate({
          where: { pageId: page.id, status: "CAPTURED" },
          _sum: { amount: true },
          _count: true,
        }),
        db.offlineDonation.aggregate({
          where: { pageId: page.id, status: "APPROVED" },
          _sum: { amount: true },
          _count: true,
        }),
        db.donation.count({
          where: {
            pageId: page.id,
            status: "CAPTURED",
            createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
          },
        }),
      ]);

      const onlineRaised = decimalToNumber(onlineAgg._sum.amount);
      const offlineRaised = decimalToNumber(offlineAgg._sum.amount);
      const totalRaised = onlineRaised + offlineRaised;
      const donorCount = onlineAgg._count + offlineAgg._count;
      const targetAmount = decimalToNumber(page.targetAmount);
      const progress = getGoalProgress(totalRaised, targetAmount);
      const stateSummary = getFundraiserStateSummary({
        status: page.status,
        visibility: page.visibility,
        reviewNotes: page.moderationItems[0]?.reviewNotes ?? null,
      });

      return {
        ...page,
        onlineRaised,
        offlineRaised,
        totalRaised,
        donorCount,
        targetAmount,
        progress,
        recentDonationsCount,
        stateSummary,
        toneStyles: getStateToneStyles(stateSummary.tone),
      };
    }),
  );

  const charityName =
    managedCharity?.charity.name ??
    (role === "PLATFORM_ADMIN" ? "Platform operations" : null);

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8" }}>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <section
          className="rounded-[2rem] p-8 md:p-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(18,78,64,1) 0%, rgba(30,140,110,1) 100%)",
            color: "#F6F1E8",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "rgba(246,241,232,0.78)" }}>
            Signed in as {user?.name ?? user?.email ?? "GiveKhair user"}
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Your GiveKhair dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 md:text-base" style={{ color: "rgba(246,241,232,0.84)" }}>
            Use this space to move between the public journey, your fundraiser pages, and any admin tools your role unlocks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {isAdmin ? (
              <Link href="/admin" className="btn-primary" style={{ background: "#F6F1E8", color: "#124E40" }}>
                Open admin panel
              </Link>
            ) : (
              <Link href="/" className="btn-primary" style={{ background: "#F6F1E8", color: "#124E40" }}>
                Browse appeals
              </Link>
            )}
            <Link href="/fundraise/new" className="btn-outline" style={{ borderColor: "rgba(246,241,232,0.4)", color: "#F6F1E8" }}>
              Start a fundraiser
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <StatCard label="Role" value={role.replaceAll("_", " ")} subtext={charityName ?? "Supporter access"} />
          <StatCard label="Active appeals" value={`${appealCount}`} subtext="currently visible on the platform" />
          <StatCard
            label="Your pages"
            value={`${myPages.length}`}
            subtext={myPages.length > 0 ? "quick links and owner tools below" : "create your first fundraiser page"}
          />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>
                  Explore the current UI
                </h2>
                <p className="text-sm" style={{ color: "#8A9E94" }}>
                  The quickest routes into the parts we&apos;ve already built.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ActionCard
                title="Public homepage"
                description="See the live public experience with featured appeals, trending appeals, and role-aware calls to action."
                href="/"
                cta="Open homepage"
              />
              <ActionCard
                title="Create fundraiser page"
                description="Start a new fundraiser linked to an active appeal, then manage updates, media, and status from one owner view."
                href="/fundraise/new"
                cta="Create fundraiser"
              />
              <ActionCard
                title="Appeal detail page"
                description="View a public appeal with progress, teams, fundraiser pages, and the donation checkout panel."
                href={recentAppeals[0] ? `/appeals/${recentAppeals[0].slug}` : "/"}
                cta={recentAppeals[0] ? "Open latest appeal" : "Open homepage"}
              />
              {isAdmin ? (
                <>
                  <ActionCard
                    title="Admin overview"
                    description="Open the charity operations dashboard with totals, donations, payouts, and quick navigation."
                    href="/admin"
                    cta="Open admin overview"
                  />
                  <ActionCard
                    title="Appeals management"
                    description="Review the appeals list, edit campaigns, and control the homepage featured appeal."
                    href="/admin/appeals"
                    cta="Manage appeals"
                  />
                  <ActionCard
                    title="Reports and exports"
                    description="Download donations, offline, payout, Gift Aid, and general ledger exports from the reporting workspace."
                    href="/admin/reports"
                    cta="Open reports"
                  />
                  <ActionCard
                    title="Moderation queue"
                    description="Review fundraiser pages, team changes, and reported content from one moderation surface."
                    href="/admin/moderation"
                    cta="Open moderation"
                  />
                </>
              ) : (
                <>
                  <ActionCard
                    title="Fundraiser management"
                    description="Open your fundraiser owner tools to update the story, post updates, and curate a gallery for supporters."
                    href={myPages[0] ? `/fundraise/${myPages[0].shortName}/edit` : "/fundraise/new"}
                    cta={myPages[0] ? "Manage a fundraiser" : "Create a fundraiser"}
                  />
                  <ActionCard
                    title="Sign in options"
                    description="Credentials and Google sign-in are both active, with dashboard-first routing after authentication."
                    href="/auth/signin?callbackUrl=%2Fdashboard"
                    cta="Open sign-in"
                  />
                </>
              )}
            </div>
          </div>

          <aside>
            <div
              style={{
                background: "white",
                borderRadius: "1rem",
                padding: "1.25rem",
                boxShadow: "0 2px 12px rgba(18,78,64,0.07)",
              }}
            >
              <h2 className="text-base font-semibold" style={{ color: "#233029" }}>
                Recent active appeals
              </h2>
              <div className="mt-4 space-y-3">
                {recentAppeals.map((appeal) => (
                  <Link
                    key={appeal.id}
                    href={`/appeals/${appeal.slug}`}
                    className="block rounded-2xl border px-4 py-3 transition-colors"
                    style={{ borderColor: "rgba(18,78,64,0.12)", color: "#233029", background: "#FCFBF7" }}
                  >
                    <p className="text-sm font-semibold">{appeal.title}</p>
                    <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                      {appeal.charity.name}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "#3A4A42" }}>
                      Goal {formatCurrency(decimalToNumber(appeal.goalAmount), appeal.currency)} · {appeal._count.fundraisingPages} pages
                    </p>
                  </Link>
                ))}
                {recentAppeals.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8A9E94" }}>
                    No active appeals yet.
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="mt-5"
              style={{
                background: "white",
                borderRadius: "1rem",
                padding: "1.25rem",
                boxShadow: "0 2px 12px rgba(18,78,64,0.07)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold" style={{ color: "#233029" }}>
                  Your fundraiser pages
                </h2>
                <Link href="/fundraise/new" className="btn-outline" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                  New page
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {myPages.map((page) => (
                  <div
                    key={page.id}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: page.toneStyles.borderColor, background: "#FCFBF7" }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#233029" }}>
                          {page.title}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                          {page.appeal.title} · /fundraise/{page.shortName}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em]"
                        style={{
                          background: page.toneStyles.badgeBackground,
                          color: page.toneStyles.badgeColor,
                        }}
                      >
                        {page.stateSummary.label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6" style={{ color: "#3A4A42" }}>
                      {page.stateSummary.description}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: "#3A4A42" }}>
                      <span>Raised {formatCurrency(page.totalRaised, page.currency)}</span>
                      <span>{page.donorCount} supporters</span>
                      <span>{page._count.updates} updates</span>
                      <span>{page.recentDonationsCount} gifts in 30 days</span>
                    </div>

                    {page.targetAmount > 0 ? (
                      <div className="mt-3 rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.8)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8A9E94" }}>
                            Goal progress
                          </span>
                          <span className="text-xs font-semibold" style={{ color: "#115E59" }}>
                            {page.progress}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${page.progress}%`,
                              background: "linear-gradient(90deg, #0F766E 0%, #14B8A6 100%)",
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/fundraise/${page.shortName}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                        View
                      </Link>
                      <Link href={`/fundraise/${page.shortName}/edit`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
                {myPages.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8A9E94" }}>
                    You haven&apos;t created a fundraiser page yet.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
