import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import { setHomepageFeaturedAppeal } from "@/lib/homepage-management";

export const metadata: Metadata = { title: "Admin - Appeals" };

function formatCurrency(value: string | number, currency = "GBP") {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusPill(status: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    DRAFT: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
    PAUSED: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
    ENDED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
  };
  const style = palette[status] ?? palette.DRAFT;
  return (
    <span
      style={{
        borderRadius: "9999px",
        padding: "2px 8px",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}

export default async function AdminAppealsPage({
  searchParams,
}: {
  searchParams: { charityId?: string; error?: string };
}) {
  const { managedCharity, role } = await getAdminContext();
  const selectedCharityId = searchParams.charityId?.trim() || "";

  if (!managedCharity && role !== "PLATFORM_ADMIN") {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Appeals</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>
          No managed charity is linked to this admin account yet.
        </p>
      </div>
    );
  }

  const [appeals, charities] = await Promise.all([
    db.appeal.findMany({
      where:
        role === "PLATFORM_ADMIN"
          ? {
              ...(selectedCharityId ? { charityId: selectedCharityId } : {}),
            }
          : { charityId: managedCharity!.id },
      include: {
        charity: { select: { id: true, name: true } },
        category: { select: { name: true } },
        _count: { select: { fundraisingPages: true, teams: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    role === "PLATFORM_ADMIN"
      ? db.charity.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  async function featureAppealAction(formData: FormData) {
    "use server";

    const { role: currentRole } = await getAdminContext();
    if (currentRole !== "PLATFORM_ADMIN") {
      redirect("/admin/appeals");
    }

    const appealId = String(formData.get("appealId") ?? "").trim();
    if (!appealId) {
      redirect("/admin/appeals");
    }

    try {
      await setHomepageFeaturedAppeal({ appealId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to feature appeal.";
      redirect(`/admin/appeals?error=${encodeURIComponent(message)}`);
    }

    revalidateAdminSurfaces(["/", "/admin/appeals"]);
    redirect("/admin/appeals");
  }

  const summary = appeals.reduce(
    (acc, appeal) => {
      acc.totalGoal += parseFloat(appeal.goalAmount.toString());
      acc.active += appeal.status === "ACTIVE" ? 1 : 0;
      acc.draft += appeal.status === "DRAFT" ? 1 : 0;
      return acc;
    },
    { totalGoal: 0, active: 0, draft: 0 }
  );

  const selectedCharity =
    role === "PLATFORM_ADMIN"
      ? charities.find((charity) => charity.id === selectedCharityId) ?? null
      : managedCharity;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Appeals</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            {role === "PLATFORM_ADMIN"
              ? selectedCharity
                ? `Manage campaign visibility, goals, and structure for ${selectedCharity.name}.`
                : "Manage campaign visibility, goals, and structure across all charities."
              : `Manage campaign visibility, goals, and structure for ${managedCharity!.name}.`}
          </p>
        </div>
        <Link href="/admin/appeals/new" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          + New appeal
        </Link>
      </div>

      {role === "PLATFORM_ADMIN" ? (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "#3A4A42" }}>Charity filter</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/appeals"
              className="btn-outline"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
            >
              All charities
            </Link>
            {charities.map((charity) => (
              <Link
                key={charity.id}
                href={`/admin/appeals?charityId=${charity.id}`}
                className="btn-outline"
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.8rem",
                  background: charity.id === selectedCharityId ? "rgba(30,140,110,0.1)" : undefined,
                  color: charity.id === selectedCharityId ? "#124E40" : undefined,
                }}
              >
                {charity.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 mb-6 sm:grid-cols-3">
        <SummaryCard label="Total appeals" value={String(appeals.length)} sub={`${summary.active} active`} />
        <SummaryCard label="Draft appeals" value={String(summary.draft)} sub="Need review before launch" />
        <SummaryCard label="Combined goals" value={formatCurrency(summary.totalGoal)} sub="Across all appeals" />
      </div>

      {"error" in searchParams && searchParams.error ? (
        <div className="mb-5 rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(185, 28, 28, 0.14)", background: "#FEF2F2", color: "#991B1B" }}>
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {[
                "Appeal",
                ...(role === "PLATFORM_ADMIN" ? ["Charity"] : []),
                "Category",
                "Goal",
                "Pages",
                "Teams",
                "Status",
                "Homepage",
                "Visibility",
                "Actions",
              ].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appeals.map((appeal, index) => (
              <tr key={appeal.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="font-semibold" style={{ color: "#233029" }}>{appeal.title}</div>
                  <div className="text-xs" style={{ color: "#8A9E94" }}>/appeals/{appeal.slug}</div>
                </td>
                {role === "PLATFORM_ADMIN" ? (
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal.charity.name}</td>
                ) : null}
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal.category?.name ?? "Uncategorised"}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>
                  {formatCurrency(appeal.goalAmount.toString(), appeal.currency)}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal._count.fundraisingPages}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal._count.teams}</td>
                <td style={{ padding: "0.9rem 1rem" }}>{statusPill(appeal.status)}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  {appeal.isFeaturedHomepage ? (
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "rgba(212,160,23,0.16)", color: "#8A5B00" }}>
                      Featured
                    </span>
                  ) : role === "PLATFORM_ADMIN" ? (
                    <span className="text-xs" style={{ color: "#8A9E94" }}>
                      {appeal.status === "ACTIVE" && appeal.visibility === "PUBLIC" ? "Eligible" : "Not eligible"}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#8A9E94" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal.visibility}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="flex flex-wrap gap-2">
                    {role === "PLATFORM_ADMIN" && !appeal.isFeaturedHomepage && appeal.status === "ACTIVE" && appeal.visibility === "PUBLIC" ? (
                      <form action={featureAppealAction}>
                        <input type="hidden" name="appealId" value={appeal.id} />
                        <button
                          type="submit"
                          className="btn-outline"
                          style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                        >
                          Feature
                        </button>
                      </form>
                    ) : null}
                    <Link
                      href={`/admin/appeals/${appeal.id}`}
                      className="btn-outline"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/appeals/${appeal.slug}`}
                      className="btn-outline"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {appeals.length === 0 && (
              <tr>
                <td colSpan={role === "PLATFORM_ADMIN" ? 10 : 9} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No appeals yet. Create the first one to start accepting fundraising pages.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.1rem 1.2rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p>
    </div>
  );
}
