import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import {
  getActivePlatformAdminCount,
  issueUserAccessToken,
  logUserAccessAudit,
  normalizeUserEmail,
  parseRole,
  userStatusLabel,
} from "@/server/lib/user-admin";

type SearchParams = {
  q?: string;
  role?: string;
  status?: string;
  notice?: string;
};

const ROLE_OPTIONS = ["DONOR", "FUNDRAISER", "TEAM_LEAD", "CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"] as const;

function formatDate(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleString("en-GB") : "—";
}

function statusPill(label: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    INVITED: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    SUSPENDED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  };
  const style = palette[label] ?? { bg: "rgba(58,74,66,0.10)", color: "#355247" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, role } = await getAdminContext();
  if (role !== "PLATFORM_ADMIN") {
    redirect("/403");
  }

  const q = (searchParams.q ?? "").trim();
  const roleFilter = (searchParams.role ?? "").trim();
  const statusFilter = (searchParams.status ?? "").trim();
  const notice = (searchParams.notice ?? "").trim();

  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(ROLE_OPTIONS.includes(roleFilter as (typeof ROLE_OPTIONS)[number]) ? { role: roleFilter as (typeof ROLE_OPTIONS)[number] } : {}),
    ...(statusFilter === "SUSPENDED"
      ? { suspendedAt: { not: null } }
      : statusFilter === "INVITED"
        ? { suspendedAt: null, invitedAt: { not: null }, passwordHash: null }
        : statusFilter === "ACTIVE"
          ? { suspendedAt: null, NOT: { invitedAt: { not: null }, passwordHash: null } }
          : {}),
  };

  async function inviteUserAction(formData: FormData) {
    "use server";

    const ctx = await getAdminContext();
    if (ctx.role !== "PLATFORM_ADMIN") {
      redirect("/403");
    }

    const email = normalizeUserEmail(String(formData.get("email") ?? ""));
    const name = String(formData.get("name") ?? "").trim() || null;
    const roleInput = String(formData.get("role") ?? "");
    const parsedRole = parseRole(roleInput);

    if (!email || !parsedRole) {
      redirect("/admin/users?notice=Please+provide+a+valid+email+and+role.");
    }

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, passwordHash: true, invitedAt: true, suspendedAt: true },
    });

    const now = new Date();
    if (existing) {
      await issueUserAccessToken({
        userId: existing.id,
        tokenType: existing.passwordHash ? "PASSWORD_RESET" : "PASSWORD_SETUP",
        createdById: ctx.userId,
        ttlHours: 48,
      });

      await logUserAccessAudit({
        actorUserId: ctx.userId,
        targetUserId: existing.id,
        action: existing.passwordHash ? "PASSWORD_RESET_TRIGGERED" : "PASSWORD_SETUP_TRIGGERED",
        reason: "Platform admin triggered invite/reset for existing account.",
        beforeJson: {
          role: existing.role,
          invitedAt: existing.invitedAt?.toISOString() ?? null,
          suspendedAt: existing.suspendedAt?.toISOString() ?? null,
        },
        afterJson: {
          role: existing.role,
          inviteTokenIssuedAt: now.toISOString(),
        },
      });

      revalidateAdminSurfaces(["/admin/users"]);
      redirect("/admin/users?notice=Existing+user+found.+Setup/reset+token+was+issued.");
    }

    const created = await db.user.create({
      data: {
        email,
        name,
        role: parsedRole,
        invitedAt: now,
        lastAccessChangeAt: now,
      },
      select: { id: true, role: true, email: true },
    });

    await issueUserAccessToken({
      userId: created.id,
      tokenType: "INVITE",
      createdById: ctx.userId,
      ttlHours: 72,
    });

    await logUserAccessAudit({
      actorUserId: ctx.userId,
      targetUserId: created.id,
      action: "USER_INVITED",
      reason: "Platform admin invited user.",
      afterJson: {
        email: created.email,
        role: created.role,
        invitedAt: now.toISOString(),
      },
    });

    revalidateAdminSurfaces(["/admin/users"]);
    redirect("/admin/users?notice=User+invited+and+password+setup+token+issued.");
  }

  async function changeRoleAction(formData: FormData) {
    "use server";

    const ctx = await getAdminContext();
    if (ctx.role !== "PLATFORM_ADMIN") {
      redirect("/403");
    }

    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    const nextRole = parseRole(String(formData.get("nextRole") ?? ""));
    if (!targetUserId || !nextRole) {
      redirect("/admin/users?notice=Invalid+role+change+request.");
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, suspendedAt: true },
    });

    if (!targetUser) {
      redirect("/admin/users?notice=User+not+found.");
    }

    if (targetUser.role === nextRole) {
      redirect("/admin/users?notice=Role+is+already+set.");
    }

    const demotingPlatformAdmin = targetUser.role === "PLATFORM_ADMIN" && nextRole !== "PLATFORM_ADMIN";
    if (demotingPlatformAdmin) {
      const activePlatformAdmins = await getActivePlatformAdminCount();
      if (activePlatformAdmins <= 1) {
        redirect("/admin/users?notice=Cannot+remove+the+last+active+Platform+Admin.");
      }
    }

    if (ctx.userId === targetUser.id && nextRole !== "PLATFORM_ADMIN") {
      redirect("/admin/users?notice=You+cannot+demote+your+own+Platform+Admin+access.");
    }

    const updated = await db.user.update({
      where: { id: targetUser.id },
      data: {
        role: nextRole,
        lastAccessChangeAt: new Date(),
      },
      select: { id: true, role: true },
    });

    await logUserAccessAudit({
      actorUserId: ctx.userId,
      targetUserId: targetUser.id,
      action: "USER_ROLE_CHANGED",
      beforeJson: { role: targetUser.role },
      afterJson: { role: updated.role },
    });

    revalidateAdminSurfaces(["/admin/users"]);
    redirect("/admin/users?notice=Role+updated.");
  }

  async function suspendToggleAction(formData: FormData) {
    "use server";

    const ctx = await getAdminContext();
    if (ctx.role !== "PLATFORM_ADMIN") {
      redirect("/403");
    }

    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    const suspend = String(formData.get("suspend") ?? "1") === "1";
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!targetUserId) {
      redirect("/admin/users?notice=Invalid+suspension+request.");
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, suspendedAt: true, suspendedReason: true },
    });
    if (!targetUser) {
      redirect("/admin/users?notice=User+not+found.");
    }

    if (targetUser.id === ctx.userId && suspend) {
      redirect("/admin/users?notice=You+cannot+suspend+your+own+account.");
    }

    if (suspend && targetUser.role === "PLATFORM_ADMIN" && !targetUser.suspendedAt) {
      const activePlatformAdmins = await getActivePlatformAdminCount();
      if (activePlatformAdmins <= 1) {
        redirect("/admin/users?notice=Cannot+suspend+the+last+active+Platform+Admin.");
      }
    }

    const nextSuspendedAt = suspend ? new Date() : null;
    const updated = await db.user.update({
      where: { id: targetUser.id },
      data: {
        suspendedAt: nextSuspendedAt,
        suspendedReason: suspend ? reason : null,
        lastAccessChangeAt: new Date(),
      },
      select: { id: true, suspendedAt: true, suspendedReason: true },
    });

    await logUserAccessAudit({
      actorUserId: ctx.userId,
      targetUserId: targetUser.id,
      action: suspend ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
      reason,
      beforeJson: {
        suspendedAt: targetUser.suspendedAt?.toISOString() ?? null,
        suspendedReason: targetUser.suspendedReason ?? null,
      },
      afterJson: {
        suspendedAt: updated.suspendedAt?.toISOString() ?? null,
        suspendedReason: updated.suspendedReason ?? null,
      },
    });

    revalidateAdminSurfaces(["/admin/users"]);
    redirect(`/admin/users?notice=${encodeURIComponent(suspend ? "User suspended." : "User unsuspended.")}`);
  }

  async function triggerPasswordAction(formData: FormData) {
    "use server";

    const ctx = await getAdminContext();
    if (ctx.role !== "PLATFORM_ADMIN") {
      redirect("/403");
    }

    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    if (!targetUserId) {
      redirect("/admin/users?notice=Invalid+password+action.");
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, passwordHash: true, suspendedAt: true },
    });
    if (!targetUser) {
      redirect("/admin/users?notice=User+not+found.");
    }

    if (targetUser.suspendedAt) {
      redirect("/admin/users?notice=Unsuspend+the+user+before+triggering+password+setup/reset.");
    }

    const tokenType = targetUser.passwordHash ? "PASSWORD_RESET" : "PASSWORD_SETUP";
    await issueUserAccessToken({
      userId: targetUser.id,
      tokenType,
      createdById: ctx.userId,
      ttlHours: 48,
    });

    await logUserAccessAudit({
      actorUserId: ctx.userId,
      targetUserId: targetUser.id,
      action: tokenType === "PASSWORD_RESET" ? "PASSWORD_RESET_TRIGGERED" : "PASSWORD_SETUP_TRIGGERED",
      beforeJson: { hasPassword: Boolean(targetUser.passwordHash) },
      afterJson: { hasPassword: Boolean(targetUser.passwordHash), tokenType },
    });

    revalidateAdminSurfaces(["/admin/users"]);
    redirect(`/admin/users?notice=${encodeURIComponent(tokenType === "PASSWORD_RESET" ? "Password reset token issued." : "Password setup token issued.")}`);
  }

  const [users, audit] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        accounts: {
          select: { provider: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.userAccessAuditLog.findMany({
      include: {
        actorUser: { select: { name: true, email: true } },
        targetUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Platform user management</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Manage user roles, suspension state, invites, and password setup/reset actions.
          </p>
        </div>
        <Link href="/admin" className="btn-outline" style={{ padding: "0.55rem 0.95rem", fontSize: "0.8rem" }}>
          Back to overview
        </Link>
      </div>

      {notice ? (
        <div className="rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FFFFFF", color: "#355247" }}>
          {notice}
        </div>
      ) : null}

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1rem" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#233029" }}>Invite or add user</h2>
        <form action={inviteUserAction} className="mt-3 grid gap-3 md:grid-cols-5">
          <input className="input" name="email" type="email" placeholder="name@example.com" required />
          <input className="input" name="name" type="text" placeholder="Optional name" />
          <select className="input" name="role" defaultValue="DONOR">
            {ROLE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1rem" }}>
            Invite user
          </button>
          <p className="text-xs self-center" style={{ color: "#8A9E94" }}>
            Passwords are never shown. Invite/reset tokens are generated for secure setup.
          </p>
        </form>
      </section>

      <form className="grid gap-3 rounded-[1rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-5">
        <input className="input" name="q" defaultValue={q} placeholder="Search by name or email" />
        <select className="input" name="role" defaultValue={roleFilter}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
        <select className="input" name="status" defaultValue={statusFilter}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INVITED">INVITED</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1rem" }}>Apply</button>
        <Link href="/admin/users" className="btn-outline justify-center" style={{ padding: "0.7rem 1rem", fontSize: "0.85rem" }}>Reset</Link>
      </form>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["User", "Role", "Status", "Auth", "Created", "Access change", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.75rem 0.9rem", textAlign: "left", color: "#8A9E94", fontSize: "0.75rem" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const status = userStatusLabel({
                suspendedAt: user.suspendedAt,
                invitedAt: user.invitedAt,
                passwordHash: user.passwordHash,
              });
              const hasGoogle = user.accounts.some((account) => account.provider === "google");
              const hasPassword = Boolean(user.passwordHash);
              const authHint = hasGoogle && hasPassword ? "Google + Password" : hasGoogle ? "Google" : hasPassword ? "Password" : "Invite pending";

              return (
                <tr key={user.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none", verticalAlign: "top" }}>
                  <td style={{ padding: "0.85rem 0.9rem", color: "#233029", fontWeight: 600 }}>
                    {user.name ?? "Unnamed user"}
                    <div className="text-xs" style={{ color: "#8A9E94", fontWeight: 500 }}>{user.email}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", color: "#3A4A42" }}>{user.role}</td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>{statusPill(status)}</td>
                  <td style={{ padding: "0.85rem 0.9rem", color: "#3A4A42" }}>{authHint}</td>
                  <td style={{ padding: "0.85rem 0.9rem", color: "#3A4A42" }}>{formatDate(user.createdAt)}</td>
                  <td style={{ padding: "0.85rem 0.9rem", color: "#3A4A42" }}>{formatDate(user.lastAccessChangeAt)}</td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div className="space-y-2">
                      <form action={changeRoleAction} className="flex gap-2">
                        <input type="hidden" name="targetUserId" value={user.id} />
                        <select name="nextRole" className="input" style={{ fontSize: "0.75rem", padding: "0.45rem 0.6rem" }} defaultValue={user.role}>
                          {ROLE_OPTIONS.map((entry) => (
                            <option key={entry} value={entry}>{entry}</option>
                          ))}
                        </select>
                        <button type="submit" className="btn-outline" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}>
                          Update
                        </button>
                      </form>

                      <form action={suspendToggleAction} className="flex gap-2">
                        <input type="hidden" name="targetUserId" value={user.id} />
                        <input type="hidden" name="suspend" value={user.suspendedAt ? "0" : "1"} />
                        {!user.suspendedAt ? (
                          <input name="reason" className="input" placeholder="Suspension reason" style={{ fontSize: "0.75rem", padding: "0.45rem 0.6rem" }} />
                        ) : null}
                        <button type="submit" className="btn-outline" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}>
                          {user.suspendedAt ? "Unsuspend" : "Suspend"}
                        </button>
                      </form>

                      <form action={triggerPasswordAction}>
                        <input type="hidden" name="targetUserId" value={user.id} />
                        <button type="submit" className="btn-outline" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}>
                          {user.passwordHash ? "Trigger password reset" : "Trigger password setup"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No users match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-4">
          <h2 className="text-sm font-semibold" style={{ color: "#233029" }}>Access audit</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["When", "Actor", "Target", "Action", "Reason"].map((heading) => (
                <th key={heading} style={{ padding: "0.7rem 0.9rem", textAlign: "left", color: "#8A9E94", fontSize: "0.72rem" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audit.map((entry, index) => (
              <tr key={entry.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.75rem 0.9rem", color: "#3A4A42" }}>{formatDate(entry.createdAt)}</td>
                <td style={{ padding: "0.75rem 0.9rem", color: "#3A4A42" }}>
                  {entry.actorUser.name ?? entry.actorUser.email}
                </td>
                <td style={{ padding: "0.75rem 0.9rem", color: "#3A4A42" }}>
                  {entry.targetUser.name ?? entry.targetUser.email}
                </td>
                <td style={{ padding: "0.75rem 0.9rem", color: "#233029", fontWeight: 600 }}>{entry.action}</td>
                <td style={{ padding: "0.75rem 0.9rem", color: "#3A4A42" }}>{entry.reason ?? "—"}</td>
              </tr>
            ))}
            {audit.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "1.8rem", textAlign: "center", color: "#8A9E94" }}>
                  No access audit entries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
