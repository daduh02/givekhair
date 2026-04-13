import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

const ADMIN_ROLES = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];

function normalizeRole(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : "DONOR";
}

function formatCurrency(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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

  const [appealCount, managedCharity, recentAppeals] = await Promise.all([
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
  ]);

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
            This is now the main signed-in hub for exploring the platform. From here you can open the
            admin experience, browse live appeals, and move into the next product areas as we build them out.
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
            <Link href="/" className="btn-outline" style={{ borderColor: "rgba(246,241,232,0.4)", color: "#F6F1E8" }}>
              View homepage
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <StatCard label="Role" value={role.replaceAll("_", " ")} subtext={charityName ?? "Supporter access"} />
          <StatCard label="Active appeals" value={`${appealCount}`} subtext="currently visible on the platform" />
          <StatCard
            label="Admin access"
            value={isAdmin ? "Enabled" : "Not enabled"}
            subtext={isAdmin ? "You can review the new admin UI now." : "Admin tools are restricted by role."}
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
                description="See the live public experience with featured appeals, role-aware CTAs, and the current fundraising shell."
                href="/"
                cta="Open homepage"
              />
              <ActionCard
                title="Appeal detail page"
                description="View a public appeal with progress, teams, fundraisers, and the donation checkout panel."
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
                    description="Review the new admin appeals list and create additional appeals from the live UI."
                    href="/admin/appeals"
                    cta="Manage appeals"
                  />
                  <ActionCard
                    title="Charity setup"
                    description="Edit the charity profile, verification state, contact details, and default settings used across appeals."
                    href="/admin/charities"
                    cta="Open charity setup"
                  />
                  <ActionCard
                    title="Create a new appeal"
                    description="Jump straight into the appeal form to add a new campaign without digging through the admin panel first."
                    href="/admin/appeals/new"
                    cta="Add appeal"
                  />
                  <ActionCard
                    title="Moderation queue"
                    description="Review charity updates, reported content, team changes, and fundraiser page moderation from one queue."
                    href="/admin/moderation"
                    cta="Open moderation"
                  />
                </>
              ) : (
                <>
                  <ActionCard
                    title="Sign in options"
                    description="Credentials and Google sign-in are both active, with dashboard-first routing after authentication."
                    href="/auth/signin?callbackUrl=%2Fdashboard"
                    cta="Open sign-in"
                  />
                  <ActionCard
                    title="Fundraising journey"
                    description="The fundraising creation flow is the next product slice to deepen, but the public appeal path is ready to inspect now."
                    href="/"
                    cta="See current flow"
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
                      Goal {formatCurrency(parseFloat(appeal.goalAmount.toString()), appeal.currency)} ·{" "}
                      {appeal._count.fundraisingPages} pages
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
          </aside>
        </section>
      </main>
    </div>
  );
}
