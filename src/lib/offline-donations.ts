import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";

type AccessibleAppeal = {
  id: string;
  title: string;
  charityId: string;
  currency: string;
  charity: { name: string };
  teams: { id: string; name: string }[];
  fundraisingPages: { id: string; shortName: string; title: string; teamId: string | null }[];
};

type NormalizedOfflineRow = {
  rowNumber: number;
  amount: number | null;
  currency: string;
  receivedDate: string | null;
  donorName: string | null;
  notes: string | null;
  giftAidDeclaration: boolean;
  pageId: string | null;
  pageShortName: string | null;
  teamId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

export type OfflineDryRunRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: NormalizedOfflineRow | null;
  errors: string[];
  duplicate: boolean;
};

export type OfflineDryRunResult = {
  batchAppealId: string;
  fileName: string;
  rowCount: number;
  errorCount: number;
  validCount: number;
  rows: OfflineDryRunRow[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function truthyGiftAid(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function parseDate(value: string | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAmount(value: string | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export async function getAccessibleAppeals(role: string, managedCharityId?: string | null) {
  return db.appeal.findMany({
    where:
      role === "PLATFORM_ADMIN"
        ? {}
        : {
            charityId: managedCharityId ?? "",
          },
    include: {
      charity: { select: { name: true } },
      teams: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      fundraisingPages: {
        select: { id: true, shortName: true, title: true, teamId: true },
        orderBy: { title: "asc" },
      },
    },
    orderBy: { title: "asc" },
  });
}

export async function dryRunOfflineCsv(input: {
  csvText: string;
  fileName: string;
  batchAppealId: string;
  role: string;
  managedCharityId?: string | null;
}) {
  const appeals = await getAccessibleAppeals(input.role, input.managedCharityId);
  const appeal = appeals.find((item) => item.id === input.batchAppealId);

  if (!appeal) {
    throw new Error("Selected appeal is not accessible.");
  }

  const records = parse(input.csvText, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: OfflineDryRunRow[] = [];

  for (const [index, raw] of records.entries()) {
    const rowNumber = index + 2;
    const errors: string[] = [];

    const rowAppealId = (raw.appeal_id ?? "").trim();
    if (rowAppealId && rowAppealId !== appeal.id) {
      errors.push(`appeal_id must match ${appeal.id}`);
    }

    const amount = parseAmount(raw.amount);
    if (amount === null || amount <= 0) {
      errors.push("amount must be a positive number");
    }

    const receivedDate = parseDate(raw.received_date);
    if (!receivedDate) {
      errors.push("received_date is required and must be a valid date");
    }

    const currency = (raw.currency ?? appeal.currency).trim().toUpperCase() || appeal.currency;

    const pageShortName = (raw.page_short_name ?? "").trim() || null;
    const teamId = (raw.team_id ?? "").trim() || null;

    let matchedPage = pageShortName
      ? appeal.fundraisingPages.find((page) => page.shortName === pageShortName)
      : null;

    if (pageShortName && !matchedPage) {
      errors.push(`page_short_name ${pageShortName} was not found on this appeal`);
    }

    if (teamId && !appeal.teams.find((team) => team.id === teamId)) {
      errors.push("team_id was not found on this appeal");
    }

    if (matchedPage && teamId && matchedPage.teamId && matchedPage.teamId !== teamId) {
      errors.push("page_short_name does not belong to the supplied team_id");
    }

    if (!matchedPage && !pageShortName) {
      if (teamId) {
        const teamPages = appeal.fundraisingPages.filter((page) => page.teamId === teamId);
        if (teamPages.length === 1) {
          matchedPage = teamPages[0];
        } else {
          errors.push("page_short_name is required when team_id matches multiple or no fundraiser pages");
        }
      } else if (appeal.fundraisingPages.length === 1) {
        matchedPage = appeal.fundraisingPages[0];
      } else {
        errors.push("page_short_name is required because this appeal has multiple fundraiser pages");
      }
    }

    const giftAidDeclaration = truthyGiftAid(raw.gift_aid_declaration);
    const donorName = (raw.donor_name ?? "").trim() || null;
    const addressLine1 = (raw.address_line_1 ?? raw.address1 ?? "").trim() || null;
    const addressLine2 = (raw.address_line_2 ?? raw.address2 ?? "").trim() || null;
    const city = (raw.city ?? "").trim() || null;
    const postcode = (raw.postcode ?? "").trim() || null;
    const country = (raw.country ?? "GB").trim().toUpperCase() || null;

    if (giftAidDeclaration) {
      if (!donorName) errors.push("donor_name is required when gift_aid_declaration is yes");
      if (!addressLine1) errors.push("address_line_1 is required when gift_aid_declaration is yes");
      if (!city) errors.push("city is required when gift_aid_declaration is yes");
      if (!postcode) errors.push("postcode is required when gift_aid_declaration is yes");
    }

    const normalized: NormalizedOfflineRow = {
      rowNumber,
      amount,
      currency,
      receivedDate,
      donorName,
      notes: (raw.notes ?? "").trim() || null,
      giftAidDeclaration,
      pageId: matchedPage?.id ?? null,
      pageShortName,
      teamId: teamId ?? matchedPage?.teamId ?? null,
      addressLine1,
      addressLine2,
      city,
      postcode,
      country,
    };

    const duplicate =
      !!normalized.amount &&
      !!normalized.receivedDate &&
      !!(await db.offlineDonation.findFirst({
        where: {
          pageId: normalized.pageId,
          amount: normalized.amount,
          currency: normalized.currency,
          receivedDate: new Date(normalized.receivedDate),
          donorName: normalized.donorName ?? undefined,
        },
        select: { id: true },
      }));

    if (duplicate) {
      errors.push("possible duplicate offline donation already exists");
    }

    rows.push({
      rowNumber,
      raw,
      normalized: errors.length === 0 ? normalized : normalized,
      errors,
      duplicate,
    });
  }

  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  const validCount = rows.length - errorCount;

  return {
    batchAppealId: appeal.id,
    fileName: input.fileName,
    rowCount: rows.length,
    errorCount,
    validCount,
    rows,
  } satisfies OfflineDryRunResult;
}

export async function createOfflineDonationsFromDryRun(input: {
  batchId: string;
  createdById: string;
}) {
  const batch = await db.offlineUploadBatch.findUnique({
    where: { id: input.batchId },
    include: {
      appeal: true,
    },
  });

  if (!batch || !batch.resultJson) {
    throw new Error("Upload batch not found.");
  }

  const result = batch.resultJson as unknown as OfflineDryRunResult;
  const validRows = result.rows.filter((row) => row.errors.length === 0 && row.normalized);

  const createdIds: string[] = [];

  await db.$transaction(async (tx) => {
    for (const row of validRows) {
      const normalized = row.normalized!;
      const offlineDonation = await tx.offlineDonation.create({
        data: {
          batchId: batch.id,
          pageId: normalized.pageId,
          amount: normalized.amount!,
          currency: normalized.currency,
          receivedDate: new Date(normalized.receivedDate!),
          donorName: normalized.donorName ?? undefined,
          notes: normalized.notes ?? undefined,
          status: "APPROVED",
          createdById: input.createdById,
        },
      });

      createdIds.push(offlineDonation.id);

      if (normalized.giftAidDeclaration) {
        await tx.giftAidDeclaration.create({
          data: {
            offlineDonationId: offlineDonation.id,
            donorFullName: normalized.donorName!,
            donorAddressLine1: normalized.addressLine1!,
            donorAddressLine2: normalized.addressLine2 ?? undefined,
            donorCity: normalized.city!,
            donorPostcode: normalized.postcode!,
            donorCountry: normalized.country ?? "GB",
            type: "SINGLE",
            statementVersion: "v1",
            statementText:
              "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
            createdById: input.createdById,
          },
        });
      }
    }

    await tx.offlineUploadBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
      },
    });
  });

  return {
    createdCount: createdIds.length,
    createdIds,
  };
}

export type AccessibleAppealOption = AccessibleAppeal;
