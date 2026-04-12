import { db } from "@/lib/db";
import { slugify } from "@/lib/admin-management";

async function findCheckoutOwnerUserId(appealId: string, charityId: string) {
  const existingPageOwner = await db.fundraisingPage.findFirst({
    where: { appealId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingPageOwner?.userId) {
    return existingPageOwner.userId;
  }

  const charityAdmin = await db.charityAdmin.findFirst({
    where: { charityId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });

  if (charityAdmin?.userId) {
    return charityAdmin.userId;
  }

  const platformAdmin = await db.user.findFirst({
    where: { role: "PLATFORM_ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (platformAdmin?.id) {
    return platformAdmin.id;
  }

  const fallbackUser = await db.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return fallbackUser?.id ?? null;
}

async function buildUniqueShortName(base: string) {
  let shortName = base;
  let suffix = 1;

  while (await db.fundraisingPage.findUnique({ where: { shortName }, select: { id: true } })) {
    suffix += 1;
    shortName = `${base}-${suffix}`;
  }

  return shortName;
}

export async function getOrCreateAppealCheckoutPage(input: {
  appealId: string;
  appealTitle: string;
  appealSlug: string;
  charityId: string;
  currency: string;
}) {
  const existing = await db.fundraisingPage.findFirst({
    where: {
      appealId: input.appealId,
      status: "ACTIVE",
    },
    orderBy: [
      { visibility: "asc" },
      { createdAt: "asc" },
    ],
  });

  if (existing) {
    return existing;
  }

  const ownerUserId = await findCheckoutOwnerUserId(input.appealId, input.charityId);
  if (!ownerUserId) {
    return null;
  }

  const shortName = await buildUniqueShortName(`${slugify(input.appealSlug || input.appealTitle)}-donate`);

  return db.fundraisingPage.create({
    data: {
      userId: ownerUserId,
      appealId: input.appealId,
      title: `${input.appealTitle} Donations`,
      shortName,
      story: `Direct donations for ${input.appealTitle}.`,
      currency: input.currency,
      status: "ACTIVE",
      visibility: "HIDDEN",
    },
  });
}
