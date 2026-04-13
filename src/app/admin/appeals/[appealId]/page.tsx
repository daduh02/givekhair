import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { AppealForm } from "@/components/admin/AppealForm";
import {
  parseMediaGallery,
  parseOptionalString,
  revalidateAdminSurfaces,
  slugify,
  toDateInput,
  upsertModerationItem,
} from "@/lib/admin-management";

export const metadata: Metadata = { title: "Admin - Edit Appeal" };

export default async function EditAppealPage({
  params,
  searchParams,
}: {
  params: { appealId: string };
  searchParams: { error?: string };
}) {
  const { managedCharity, role, userId } = await getAdminContext();

  const [categories, charities, appeal] = await Promise.all([
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    role === "PLATFORM_ADMIN"
      ? db.charity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, defaultCurrency: true } })
      : Promise.resolve([]),
    db.appeal.findFirst({
      where: {
        id: params.appealId,
        ...(role === "PLATFORM_ADMIN" ? {} : { charityId: managedCharity?.id }),
      },
      include: {
        charity: { select: { id: true, name: true, defaultCurrency: true } },
        teams: {
          include: {
            members: {
              include: {
                user: { select: { id: true, email: true, name: true, role: true } },
              },
            },
            pages: {
              include: {
                user: { select: { name: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        fundraisingPages: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  if (!appeal) {
    redirect("/admin/appeals");
  }

  async function updateAppeal(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole, userId: currentUserId } = await getAdminContext();

    const editableAppeal = await db.appeal.findFirst({
      where: {
        id: params.appealId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { charityId: currentManagedCharity?.id }),
      },
      select: { id: true, slug: true, charityId: true, title: true },
    });

    if (!editableAppeal) {
      redirect("/admin/appeals");
    }

    const title = String(formData.get("title") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const slug = slugify(slugInput || title);
    const goalAmount = Number(formData.get("goalAmount") ?? 0);
    const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
    const categoryId = parseOptionalString(formData.get("categoryId"));
    const charityIdInput = String(formData.get("charityId") ?? "").trim();
    const charityId = currentRole === "PLATFORM_ADMIN" ? charityIdInput : editableAppeal.charityId;
    const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
    const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
    const bannerUrl = parseOptionalString(formData.get("bannerUrl"));
    const story = parseOptionalString(formData.get("story"));
    const impact = parseOptionalString(formData.get("impact"));
    const donorSupportOverrideInput = String(formData.get("donorSupportOverride") ?? "inherit").trim();
    const donorSupportOverride =
      donorSupportOverrideInput === "enabled"
        ? true
        : donorSupportOverrideInput === "disabled"
          ? false
          : null;
    const mediaGallery = parseMediaGallery(String(formData.get("mediaGallery") ?? ""));
    const status = String(formData.get("status") ?? "DRAFT").trim() as "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
    const visibility = String(formData.get("visibility") ?? "PUBLIC").trim() as "PUBLIC" | "UNLISTED" | "HIDDEN";

    if (!title || !slug || !charityId || !Number.isFinite(goalAmount) || goalAmount <= 0) {
      redirect(`/admin/appeals/${params.appealId}?error=invalid`);
    }

    const duplicate = await db.appeal.findFirst({
      where: {
        slug,
        NOT: { id: params.appealId },
      },
      select: { id: true },
    });

    if (duplicate) {
      redirect(`/admin/appeals/${params.appealId}?error=slug`);
    }

    const updated = await db.appeal.update({
      where: { id: params.appealId },
      data: {
        charityId,
        categoryId: categoryId ?? null,
        title,
        slug,
        goalAmount,
        currency,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        bannerUrl: bannerUrl ?? null,
        story: story ?? null,
        impact: impact ?? null,
        donorSupportOverride,
        mediaGallery,
        status,
        visibility,
      },
    });

    await upsertModerationItem({
      entityType: "APPEAL",
      entityId: updated.id,
      charityId: updated.charityId,
      appealId: updated.id,
      title: `Appeal update submitted: ${updated.title}`,
      summary: impact ?? story ?? null,
      status: "PENDING",
      submittedById: currentUserId,
    });

    revalidateAdminSurfaces([
      `/admin/appeals/${updated.id}`,
      `/appeals/${editableAppeal.slug}`,
      `/appeals/${updated.slug}`,
    ]);
    redirect(`/admin/appeals/${updated.id}`);
  }

  async function createTeam(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole, userId: currentUserId } = await getAdminContext();
    const editableAppeal = await db.appeal.findFirst({
      where: {
        id: params.appealId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { charityId: currentManagedCharity?.id }),
      },
      select: { id: true, charityId: true, title: true },
    });

    if (!editableAppeal) {
      redirect("/admin/appeals");
    }

    const name = String(formData.get("name") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const slug = slugify(slugInput || name);
    const description = parseOptionalString(formData.get("description"));
    const goalAmountRaw = parseOptionalString(formData.get("goalAmount"));
    const goalAmount = goalAmountRaw ? Number(goalAmountRaw) : null;
    const visibility = String(formData.get("visibility") ?? "PUBLIC").trim() as "PUBLIC" | "UNLISTED" | "HIDDEN";
    const status = String(formData.get("status") ?? "ACTIVE").trim() as "DRAFT" | "ACTIVE" | "HIDDEN" | "BANNED";

    if (!name || !slug) {
      redirect(`/admin/appeals/${params.appealId}?error=team`);
    }

    const duplicate = await db.team.findFirst({
      where: { appealId: editableAppeal.id, slug },
      select: { id: true },
    });

    if (duplicate) {
      redirect(`/admin/appeals/${params.appealId}?error=team-slug`);
    }

    const team = await db.team.create({
      data: {
        appealId: editableAppeal.id,
        name,
        slug,
        description,
        goalAmount: goalAmount && Number.isFinite(goalAmount) ? goalAmount : null,
        visibility,
        status,
      },
    });

    await upsertModerationItem({
      entityType: "TEAM",
      entityId: team.id,
      charityId: editableAppeal.charityId,
      appealId: editableAppeal.id,
      teamId: team.id,
      title: `Team submitted: ${team.name}`,
      summary: description,
      status: "PENDING",
      submittedById: currentUserId,
    });

    revalidateAdminSurfaces([`/admin/appeals/${params.appealId}`]);
    redirect(`/admin/appeals/${params.appealId}`);
  }

  async function inviteMember(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole } = await getAdminContext();
    const editableAppeal = await db.appeal.findFirst({
      where: {
        id: params.appealId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { charityId: currentManagedCharity?.id }),
      },
      select: { id: true },
    });

    if (!editableAppeal) {
      redirect("/admin/appeals");
    }

    const teamId = String(formData.get("teamId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const isLead = String(formData.get("isLead") ?? "") === "on";

    if (!teamId || !email) {
      redirect(`/admin/appeals/${params.appealId}?error=invite`);
    }

    const team = await db.team.findFirst({
      where: { id: teamId, appealId: editableAppeal.id },
      select: { id: true },
    });
    if (!team) {
      redirect(`/admin/appeals/${params.appealId}`);
    }

    const user = await db.user.upsert({
      where: { email },
      update: {
        role: isLead ? "TEAM_LEAD" : undefined,
      },
      create: {
        email,
        role: isLead ? "TEAM_LEAD" : "FUNDRAISER",
      },
    });

    await db.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: { isLead },
      create: { teamId: team.id, userId: user.id, isLead },
    });

    revalidateAdminSurfaces([`/admin/appeals/${params.appealId}`]);
    redirect(`/admin/appeals/${params.appealId}`);
  }

  async function removeMember(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole } = await getAdminContext();
    const editableAppeal = await db.appeal.findFirst({
      where: {
        id: params.appealId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { charityId: currentManagedCharity?.id }),
      },
      select: { id: true },
    });

    if (!editableAppeal) {
      redirect("/admin/appeals");
    }

    const membershipId = String(formData.get("membershipId") ?? "").trim();
    if (!membershipId) {
      redirect(`/admin/appeals/${params.appealId}`);
    }

    await db.teamMember.delete({ where: { id: membershipId } });
    revalidateAdminSurfaces([`/admin/appeals/${params.appealId}`]);
    redirect(`/admin/appeals/${params.appealId}`);
  }

  async function moderatePage(formData: FormData) {
    "use server";

    const { managedCharity: currentManagedCharity, role: currentRole, userId: currentUserId } = await getAdminContext();
    const pageId = String(formData.get("pageId") ?? "").trim();
    const status = String(formData.get("status") ?? "PENDING_APPROVAL").trim() as
      | "DRAFT"
      | "PENDING_APPROVAL"
      | "ACTIVE"
      | "REJECTED"
      | "SUSPENDED"
      | "BANNED"
      | "ENDED";
    const visibility = String(formData.get("visibility") ?? "PUBLIC").trim() as "PUBLIC" | "UNLISTED" | "HIDDEN";
    const reviewNotes = parseOptionalString(formData.get("reviewNotes"));

    const page = await db.fundraisingPage.findFirst({
      where: {
        id: pageId,
        appealId: params.appealId,
        appeal: currentRole === "PLATFORM_ADMIN" ? undefined : { charityId: currentManagedCharity?.id },
      },
      include: { appeal: { select: { charityId: true } } },
    });

    if (!page) {
      redirect(`/admin/appeals/${params.appealId}`);
    }

    const nextVisibility = status === "BANNED" || status === "REJECTED" ? "HIDDEN" : visibility;

    const updated = await db.fundraisingPage.update({
      where: { id: page.id },
      data: {
        status,
        visibility: nextVisibility,
      },
    });

    await upsertModerationItem({
      entityType: "FUNDRAISING_PAGE",
      entityId: updated.id,
      charityId: page.appeal.charityId,
      appealId: params.appealId,
      teamId: updated.teamId,
      pageId: updated.id,
      title: `Fundraiser page moderation: ${updated.title}`,
      summary: reviewNotes ?? `Status ${status}, visibility ${nextVisibility}`,
      status:
        status === "BANNED"
          ? "BANNED"
          : status === "REJECTED"
            ? "REJECTED"
            : nextVisibility === "HIDDEN"
              ? "HIDDEN"
              : "APPROVED",
      reviewedById: currentUserId,
      reviewNotes,
    });

    revalidateAdminSurfaces([`/admin/appeals/${params.appealId}`, `/fundraise/${updated.shortName}`]);
    redirect(`/admin/appeals/${params.appealId}`);
  }

  const errorMessage =
    searchParams.error === "slug"
      ? "That appeal slug is already in use."
      : searchParams.error === "invalid"
        ? "Please fill in the title, charity, and a valid goal amount."
        : searchParams.error === "team"
          ? "Team name is required."
          : searchParams.error === "team-slug"
            ? "That team slug is already in use for this appeal."
            : searchParams.error === "invite"
              ? "Please provide a valid team member email."
              : "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>
            Edit appeal
          </h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Update campaign details, teams, and fundraiser page moderation for {appeal.title}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/appeals/${appeal.slug}`} className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            View public page
          </Link>
          <Link href="/admin/appeals" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Back to appeals
          </Link>
        </div>
      </div>

      <AppealForm
        action={updateAppeal}
        errorMessage={errorMessage}
        categories={categories}
        charities={charities.map((charity) => ({ id: charity.id, name: charity.name }))}
        showCharitySelect={role === "PLATFORM_ADMIN"}
        submitLabel="Save changes"
        cancelHref="/admin/appeals"
        initialValues={{
          title: appeal.title,
          slug: appeal.slug,
          goalAmount: appeal.goalAmount.toString(),
          currency: appeal.currency,
          charityId: appeal.charityId,
          categoryId: appeal.categoryId ?? "",
          bannerUrl: appeal.bannerUrl ?? "",
          startsAt: toDateInput(appeal.startsAt),
          endsAt: toDateInput(appeal.endsAt),
          status: appeal.status,
          visibility: appeal.visibility,
          donorSupportOverride:
            appeal.donorSupportOverride === true
              ? "enabled"
              : appeal.donorSupportOverride === false
                ? "disabled"
                : "inherit",
          story: appeal.story ?? "",
          impact: appeal.impact ?? "",
          mediaGallery: Array.isArray(appeal.mediaGallery) ? appeal.mediaGallery.join("\n") : "",
        }}
      />

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Teams</h2>
            <p className="text-sm" style={{ color: "#8A9E94" }}>
              Create teams, set visibility, and manage members under this appeal.
            </p>
          </div>
        </div>

        <form action={createTeam} className="grid gap-4 md:grid-cols-2">
          <Field label="Team name">
            <input name="name" className="input" required />
          </Field>
          <Field label="Slug">
            <input name="slug" className="input" />
          </Field>
          <Field label="Goal amount">
            <input name="goalAmount" type="number" step="0.01" min="0" className="input" />
          </Field>
          <Field label="Visibility">
            <select name="visibility" className="input" defaultValue="PUBLIC">
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" className="input" defaultValue="ACTIVE">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="HIDDEN">Hidden</option>
              <option value="BANNED">Banned</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea name="description" className="input" rows={3} style={{ resize: "vertical" }} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.25rem" }}>
              Create team
            </button>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          {appeal.teams.map((team) => (
            <div key={team.id} className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold" style={{ color: "#233029" }}>{team.name}</h3>
                  <p className="text-xs" style={{ color: "#8A9E94" }}>
                    {team.status} · {team.visibility} · {team.pages.length} pages
                  </p>
                </div>
              </div>

              <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                {team.description ?? "No team description yet."}
              </p>

              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2" style={{ color: "#233029" }}>Invite member</h4>
                <form action={inviteMember} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="teamId" value={team.id} />
                  <input name="email" type="email" className="input" placeholder="member@example.com" required />
                  <label className="inline-flex items-center gap-2 text-sm" style={{ color: "#3A4A42" }}>
                    <input type="checkbox" name="isLead" />
                    Team lead
                  </label>
                  <button type="submit" className="btn-outline" style={{ padding: "0.65rem 1rem" }}>
                    Invite
                  </button>
                </form>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(18,78,64,0.12)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#F6F1E8" }}>
                      {["Member", "Role", "Joined", "Actions"].map((heading) => (
                        <th key={heading} style={{ padding: "0.7rem 0.9rem", textAlign: "left", color: "#8A9E94", fontSize: "0.75rem" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {team.members.map((member, index) => (
                      <tr key={member.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                        <td style={{ padding: "0.75rem 0.9rem", color: "#233029" }}>
                          {member.user.name ?? member.user.email}
                        </td>
                        <td style={{ padding: "0.75rem 0.9rem", color: "#3A4A42" }}>
                          {member.isLead ? "Lead" : member.user.role}
                        </td>
                        <td style={{ padding: "0.75rem 0.9rem", color: "#8A9E94" }}>
                          {member.joinedAt.toLocaleDateString("en-GB")}
                        </td>
                        <td style={{ padding: "0.75rem 0.9rem" }}>
                          <form action={removeMember}>
                            <input type="hidden" name="membershipId" value={member.id} />
                            <button type="submit" className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {team.members.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "1rem", color: "#8A9E94", textAlign: "center" }}>
                          No members yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {appeal.teams.length === 0 ? (
            <p className="text-sm" style={{ color: "#8A9E94" }}>No teams created for this appeal yet.</p>
          ) : null}
        </div>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Fundraiser pages</h2>
            <p className="text-sm" style={{ color: "#8A9E94" }}>
              Approve, reject, hide, or ban fundraiser pages linked to this appeal.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {appeal.fundraisingPages.map((page) => (
            <form
              key={page.id}
              action={moderatePage}
              className="rounded-2xl border p-4"
              style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}
            >
              <input type="hidden" name="pageId" value={page.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold" style={{ color: "#233029" }}>{page.title}</h3>
                  <p className="text-xs" style={{ color: "#8A9E94" }}>
                    {page.user.name ?? page.user.email} {page.team ? `· Team: ${page.team.name}` : "· Solo fundraiser"}
                  </p>
                </div>
                <Link href={`/fundraise/${page.shortName}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                  View page
                </Link>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <select name="status" className="input" defaultValue={page.status}>
                    <option value="PENDING_APPROVAL">Pending approval</option>
                    <option value="ACTIVE">Approve / active</option>
                    <option value="REJECTED">Reject</option>
                    <option value="SUSPENDED">Suspend</option>
                    <option value="BANNED">Ban</option>
                    <option value="ENDED">End</option>
                  </select>
                </Field>
                <Field label="Visibility">
                  <select name="visibility" className="input" defaultValue={page.visibility}>
                    <option value="PUBLIC">Public</option>
                    <option value="UNLISTED">Unlisted</option>
                    <option value="HIDDEN">Hidden</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Moderation notes">
                  <textarea name="reviewNotes" className="input" rows={3} style={{ resize: "vertical" }} />
                </Field>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="submit" className="btn-primary" style={{ padding: "0.65rem 1rem" }}>
                  Save moderation
                </button>
              </div>
            </form>
          ))}

          {appeal.fundraisingPages.length === 0 ? (
            <p className="text-sm" style={{ color: "#8A9E94" }}>No fundraiser pages exist for this appeal yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="block text-sm font-medium mb-2" style={{ color: "#3A4A42" }}>{label}</span>
      {children}
    </label>
  );
}
