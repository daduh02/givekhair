import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type {
  AppealStatus,
  AppealVisibility,
  CharityStatus,
  CharityVerificationStatus,
  PageStatus,
  PageVisibility,
  TeamStatus,
} from "@prisma/client";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function parseMediaGallery(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseOptionalString(value: FormDataEntryValue | null) {
  const parsed = String(value ?? "").trim();
  return parsed ? parsed : null;
}

export async function upsertModerationItem(input: {
  entityType: "CHARITY" | "APPEAL" | "TEAM" | "FUNDRAISING_PAGE" | "REPORTED_CONTENT";
  entityId?: string | null;
  charityId?: string | null;
  appealId?: string | null;
  teamId?: string | null;
  pageId?: string | null;
  title: string;
  summary?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "BANNED";
  submittedById?: string | null;
  reviewedById?: string | null;
  reviewNotes?: string | null;
}) {
  const existing = input.entityType !== "REPORTED_CONTENT" && input.entityId
    ? await db.moderationItem.findFirst({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
        select: { id: true },
      })
    : null;

  if (existing) {
    return db.moderationItem.update({
      where: { id: existing.id },
      data: {
        charityId: input.charityId ?? null,
        appealId: input.appealId ?? null,
        teamId: input.teamId ?? null,
        pageId: input.pageId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? "PENDING",
        submittedById: input.submittedById ?? null,
        reviewedById: input.reviewedById ?? null,
        reviewNotes: input.reviewNotes ?? null,
        reviewedAt: input.reviewedById ? new Date() : null,
      },
    });
  }

  return db.moderationItem.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      charityId: input.charityId ?? null,
      appealId: input.appealId ?? null,
      teamId: input.teamId ?? null,
      pageId: input.pageId ?? null,
      title: input.title,
      summary: input.summary ?? null,
      status: input.status ?? "PENDING",
      submittedById: input.submittedById ?? null,
      reviewedById: input.reviewedById ?? null,
      reviewNotes: input.reviewNotes ?? null,
      reviewedAt: input.reviewedById ? new Date() : null,
    },
  });
}

export function revalidateAdminSurfaces(extraPaths: string[] = []) {
  const paths = [
    "/",
    "/dashboard",
    "/admin",
    "/admin/appeals",
    "/admin/charities",
    "/admin/moderation",
    ...extraPaths,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export type CharityFormValues = {
  name: string;
  slug: string;
  charityNumber: string | null;
  verificationStatus: CharityVerificationStatus;
  logoUrl: string | null;
  websiteUrl: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  contactEmail: string | null;
  defaultCurrency: string;
  status: CharityStatus;
};

export type AppealFormValues = {
  title: string;
  slug: string;
  goalAmount: number;
  currency: string;
  startsAt: Date | null;
  endsAt: Date | null;
  bannerUrl: string | null;
  story: string | null;
  impact: string | null;
  mediaGallery: string[];
  status: AppealStatus;
  visibility: AppealVisibility;
  charityId: string;
  categoryId: string | null;
};

export type TeamFormValues = {
  name: string;
  slug: string;
  description: string | null;
  goalAmount: number | null;
  visibility: AppealVisibility;
  status: TeamStatus;
  appealId: string;
};

export type PageModerationValues = {
  status: PageStatus;
  visibility: PageVisibility;
};
