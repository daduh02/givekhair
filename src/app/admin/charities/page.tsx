import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin - Charities" };

export default async function CharitiesPage({
}: {
  searchParams: { error?: string };
}) {
  const { role, managedCharity } = await getAdminContext();

  const charities = await db.charity.findMany({
    where: role === "PLATFORM_ADMIN" ? {} : { id: managedCharity?.id ?? "" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { appeals: true, admins: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Charities</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Create, review, and update charity profiles linked to appeals and admins.
          </p>
        </div>
        <div className="flex gap-2">
          {managedCharity ? (
            <Link href={`/admin/charities/${managedCharity.id}`} className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
              Open current charity
            </Link>
          ) : null}
          {role === "PLATFORM_ADMIN" ? (
            <Link href="/admin/charities/new" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
              Create charity
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Charity", "Status", "Verification", "Currency", "Appeals", "Admins", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {charities.map((charity, index) => (
              <tr key={charity.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <Link href={`/admin/charities/${charity.id}`} className="font-semibold" style={{ color: "#233029", textDecoration: "none" }}>
                    {charity.name}
                  </Link>
                  <div className="text-xs" style={{ color: "#8A9E94" }}>{charity.contactEmail ?? charity.slug}</div>
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.status}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.verificationStatus}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.defaultCurrency}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity._count.appeals}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity._count.admins}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <Link href={`/admin/charities/${charity.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
