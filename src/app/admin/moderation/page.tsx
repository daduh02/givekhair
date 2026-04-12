import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces, upsertModerationItem } from "@/lib/admin-management";

export const metadata: Metadata = { title: "Admin - Moderation" };

export default async function ModerationPage() {
  const { managedCharity, role } = await getAdminContext();

  const charityFilter = role === "PLATFORM_ADMIN" ? {} : { charityId: managedCharity?.id };

  const [items, pages, charities] = await Promise.all([
    db.moderationItem.findMany({
      where: charityFilter,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.fundraisingPage.findMany({
      where: {
        appeal: role === "PLATFORM_ADMIN" ? undefined : { charityId: managedCharity?.id },
      },
      include: {
        user: { select: { name: true, email: true } },
        appeal: { select: { id: true, title: true, charityId: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    role === "PLATFORM_ADMIN"
      ? db.charity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  async function reviewItem(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole, userId: currentUserId } = await getAdminContext();
    const itemId = String(formData.get("itemId") ?? "").trim();
    const status = String(formData.get("status") ?? "PENDING").trim() as "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "BANNED";
    const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;

    const item = await db.moderationItem.findFirst({
      where: {
        id: itemId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { charityId: currentManagedCharity?.id }),
      },
    });

    if (!item) {
      redirect("/admin/moderation");
    }

    await db.moderationItem.update({
      where: { id: item.id },
      data: {
        status,
        reviewNotes,
        reviewedById: currentUserId,
        reviewedAt: new Date(),
      },
    });

    if (item.entityType === "APPEAL" && item.appealId) {
      await db.appeal.update({
        where: { id: item.appealId },
        data: {
          visibility: status === "HIDDEN" || status === "BANNED" ? "HIDDEN" : undefined,
          status: status === "APPROVED" ? "ACTIVE" : status === "REJECTED" ? "DRAFT" : status === "BANNED" ? "ENDED" : undefined,
        },
      });
    }

    if (item.entityType === "TEAM" && item.teamId) {
      await db.team.update({
        where: { id: item.teamId },
        data: {
          visibility: status === "HIDDEN" || status === "BANNED" ? "HIDDEN" : undefined,
          status: status === "APPROVED" ? "ACTIVE" : status === "BANNED" ? "BANNED" : status === "HIDDEN" ? "HIDDEN" : undefined,
        },
      });
    }

    if (item.entityType === "FUNDRAISING_PAGE" && item.pageId) {
      await db.fundraisingPage.update({
        where: { id: item.pageId },
        data: {
          visibility: status === "HIDDEN" || status === "BANNED" ? "HIDDEN" : "PUBLIC",
          status:
            status === "APPROVED"
              ? "ACTIVE"
              : status === "REJECTED"
                ? "REJECTED"
                : status === "BANNED"
                  ? "BANNED"
                  : status === "HIDDEN"
                    ? "SUSPENDED"
                    : undefined,
        },
      });
    }

    if (item.entityType === "CHARITY" && item.charityId) {
      await db.charity.update({
        where: { id: item.charityId },
        data: {
          verificationStatus: status === "APPROVED" ? "VERIFIED" : status === "REJECTED" ? "REJECTED" : undefined,
          status: status === "BANNED" ? "ARCHIVED" : status === "APPROVED" ? "ACTIVE" : undefined,
          isVerified: status === "APPROVED",
          isActive: status === "APPROVED",
        },
      });
    }

    revalidateAdminSurfaces();
    redirect("/admin/moderation");
  }

  async function reportContent(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole, userId: currentUserId } = await getAdminContext();
    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    const charityId = currentRole === "PLATFORM_ADMIN"
      ? (String(formData.get("charityId") ?? "").trim() || null)
      : (currentManagedCharity?.id ?? null);

    if (!title) {
      redirect("/admin/moderation");
    }

    await upsertModerationItem({
      entityType: "REPORTED_CONTENT",
      charityId,
      title,
      summary,
      status: "PENDING",
      submittedById: currentUserId,
    });

    revalidateAdminSurfaces();
    redirect("/admin/moderation");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Moderation queue</h1>
        <p className="text-sm" style={{ color: "#8A9E94" }}>
          Review charity updates, appeals, teams, fundraiser pages, and reported content from one place.
        </p>
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "#233029" }}>Queue</h2>
        <div className="space-y-4">
          {items.map((item) => (
            <form key={item.id} action={reviewItem} className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}>
              <input type="hidden" name="itemId" value={item.id} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#233029" }}>{item.title}</p>
                  <p className="text-xs" style={{ color: "#8A9E94" }}>{item.entityType} · {item.status}</p>
                </div>
                <select name="status" className="input" defaultValue={item.status} style={{ maxWidth: "180px" }}>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                  <option value="HIDDEN">Hide</option>
                  <option value="BANNED">Ban</option>
                </select>
              </div>
              {item.summary ? (
                <p className="mt-3 text-sm" style={{ color: "#3A4A42" }}>{item.summary}</p>
              ) : null}
              <textarea
                name="reviewNotes"
                className="input mt-3"
                rows={3}
                placeholder="Review notes"
                defaultValue={item.reviewNotes ?? ""}
                style={{ resize: "vertical" }}
              />
              <div className="mt-3 flex gap-2">
                <button type="submit" className="btn-primary" style={{ padding: "0.6rem 1rem" }}>
                  Save review
                </button>
              </div>
            </form>
          ))}
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: "#8A9E94" }}>No moderation items yet.</p>
          ) : null}
        </div>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "#233029" }}>Fundraiser page status</h2>
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#233029" }}>{page.title}</p>
                  <p className="text-xs" style={{ color: "#8A9E94" }}>
                    {page.user.name ?? page.user.email} · {page.appeal.title} {page.team ? `· ${page.team.name}` : ""}
                  </p>
                </div>
                <div className="text-xs" style={{ color: "#3A4A42" }}>
                  {page.status} · {page.visibility}
                </div>
              </div>
              <div className="mt-3">
                <Link href={`/admin/appeals/${page.appeal.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                  Moderate from appeal
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "#233029" }}>Report content</h2>
        <form action={reportContent} className="space-y-4">
          <input name="title" className="input" placeholder="Reported content title" required />
          <textarea name="summary" className="input" rows={4} placeholder="Describe the report or moderation concern." style={{ resize: "vertical" }} />
          {role === "PLATFORM_ADMIN" ? (
            <select name="charityId" className="input" defaultValue={managedCharity?.id ?? ""}>
              <option value="">No charity linked</option>
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>{charity.name}</option>
              ))}
            </select>
          ) : null}
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.25rem" }}>
            Add to moderation queue
          </button>
        </form>
      </section>
    </div>
  );
}
