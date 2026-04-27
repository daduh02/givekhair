import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCanAccessCharity } from "@/server/lib/access-control";

const ADMIN_ROLES = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"] as const;

export async function getAdminContext() {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  const role = (session.user as { role?: string } | undefined)?.role ?? "DONOR";
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    redirect("/403");
  }

  const userId = (session.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  const charityAdmin = await db.charityAdmin.findFirst({
    where: { userId },
    include: { charity: true },
    orderBy: { createdAt: "asc" },
  });

  const managedCharity =
    charityAdmin?.charity ??
    (role === "PLATFORM_ADMIN"
      ? await db.charity.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        })
      : null);

  return {
    session,
    userId,
    role,
    managedCharity,
  };
}

export async function requireAdminCharityAccess(charityId: string) {
  const context = await getAdminContext();

  try {
    await assertCanAccessCharity(context.userId, context.role, charityId);
  } catch {
    redirect("/admin/charities");
  }

  return context;
}
