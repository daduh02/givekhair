import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";

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

export default async function AdminAppealsPage() {
  const { managedCharity } = await getAdminContext();

  if (!managedCharity) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Appeals</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>
          No managed charity is linked to this admin account yet.
        </p>
      </div>
    );
  }

  const appeals = await db.appeal.findMany({
    where: { charityId: managedCharity.id },
    include: {
      category: { select: { name: true } },
      _count: { select: { fundraisingPages: true, teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const summary = appeals.reduce(
    (acc, appeal) => {
      acc.totalGoal += parseFloat(appeal.goalAmount.toString());
      acc.active += appeal.status === "ACTIVE" ? 1 : 0;
      acc.draft += appeal.status === "DRAFT" ? 1 : 0;
      return acc;
    },
    { totalGoal: 0, active: 0, draft: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Appeals</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Manage campaign visibility, goals, and structure for {managedCharity.name}.
          </p>
        </div>
        <Link href="/admin/appeals/new" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          + New appeal
        </Link>
      </div>

      <div className="grid gap-3 mb-6 sm:grid-cols-3">
        <SummaryCard label="Total appeals" value={String(appeals.length)} sub={`${summary.active} active`} />
        <SummaryCard label="Draft appeals" value={String(summary.draft)} sub="Need review before launch" />
        <SummaryCard label="Combined goals" value={formatCurrency(summary.totalGoal)} sub="Across all appeals" />
      </div>

      <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Appeal", "Category", "Goal", "Pages", "Teams", "Status", "Visibility", "Actions"].map((heading) => (
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
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal.category?.name ?? "Uncategorised"}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>
                  {formatCurrency(appeal.goalAmount.toString(), appeal.currency)}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal._count.fundraisingPages}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal._count.teams}</td>
                <td style={{ padding: "0.9rem 1rem" }}>{statusPill(appeal.status)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{appeal.visibility}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="flex flex-wrap gap-2">
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
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
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
