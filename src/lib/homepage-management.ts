import { db } from "@/lib/db";

export async function setHomepageFeaturedAppeal(input: {
  appealId: string;
}) {
  const appeal = await db.appeal.findUnique({
    where: { id: input.appealId },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
    },
  });

  if (!appeal) {
    throw new Error("Appeal not found.");
  }

  if (appeal.status !== "ACTIVE" || appeal.visibility !== "PUBLIC") {
    throw new Error("Only active public appeals can be featured on the homepage.");
  }

  // Single-feature enforcement is done transactionally so the homepage never
  // ends up with multiple featured appeals after a toggle action.
  await db.$transaction([
    db.appeal.updateMany({
      where: { isFeaturedHomepage: true },
      data: { isFeaturedHomepage: false },
    }),
    db.appeal.update({
      where: { id: appeal.id },
      data: { isFeaturedHomepage: true },
    }),
  ]);

  return appeal;
}

export async function clearHomepageFeaturedAppeal(input: {
  appealId: string;
}) {
  const appeal = await db.appeal.findUnique({
    where: { id: input.appealId },
    select: {
      id: true,
      title: true,
      isFeaturedHomepage: true,
    },
  });

  if (!appeal) {
    throw new Error("Appeal not found.");
  }

  if (!appeal.isFeaturedHomepage) {
    return appeal;
  }

  await db.appeal.update({
    where: { id: appeal.id },
    data: { isFeaturedHomepage: false },
  });

  return appeal;
}
