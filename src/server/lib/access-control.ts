import { db } from "@/lib/db";

type AdminRole = "CHARITY_ADMIN" | "FINANCE" | "PLATFORM_ADMIN" | string;

export function hasCharityAccess(accessibleCharityIds: string[], charityId: string) {
  return accessibleCharityIds.includes(charityId);
}

export async function getAccessibleCharityIds(userId: string, role: AdminRole) {
  if (role === "PLATFORM_ADMIN" || role === "FINANCE") {
    const charities = await db.charity.findMany({
      select: { id: true },
    });

    return charities.map((charity) => charity.id);
  }

  if (role !== "CHARITY_ADMIN") {
    return [];
  }

  const assignments = await db.charityAdmin.findMany({
    where: { userId },
    select: { charityId: true },
  });

  return assignments.map((assignment) => assignment.charityId);
}

export async function assertCanAccessCharity(userId: string, role: AdminRole, charityId: string) {
  const accessibleCharityIds = await getAccessibleCharityIds(userId, role);
  if (!hasCharityAccess(accessibleCharityIds, charityId)) {
    throw new Error("Forbidden");
  }
}
