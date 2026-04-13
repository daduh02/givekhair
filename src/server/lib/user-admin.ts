import { createHash, randomBytes } from "crypto";
import type { Prisma, UserRole, UserAccessAuditAction, UserAccessTokenType } from "@prisma/client";
import { db } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseRole(input: string): UserRole | null {
  const roles: UserRole[] = ["DONOR", "FUNDRAISER", "TEAM_LEAD", "CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];
  return roles.includes(input as UserRole) ? (input as UserRole) : null;
}

export function userStatusLabel(input: {
  suspendedAt: Date | null;
  invitedAt: Date | null;
  passwordHash: string | null;
}) {
  if (input.suspendedAt) {
    return "SUSPENDED";
  }
  if (input.invitedAt && !input.passwordHash) {
    return "INVITED";
  }
  return "ACTIVE";
}

export async function getActivePlatformAdminCount() {
  return db.user.count({
    where: {
      role: "PLATFORM_ADMIN",
      suspendedAt: null,
    },
  });
}

export async function logUserAccessAudit(input: {
  actorUserId: string;
  targetUserId: string;
  action: UserAccessAuditAction;
  reason?: string | null;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
}) {
  return db.userAccessAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      action: input.action,
      reason: input.reason ?? null,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
    },
  });
}

export async function issueUserAccessToken(input: {
  userId: string;
  tokenType: UserAccessTokenType;
  createdById?: string | null;
  ttlHours?: number;
}) {
  const ttlHours = input.ttlHours ?? 72;
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.userAccessToken.create({
    data: {
      userId: input.userId,
      tokenType: input.tokenType,
      tokenHash,
      expiresAt,
      createdById: input.createdById ?? null,
    },
  });

  return {
    rawToken,
    expiresAt,
  };
}

export async function consumeUserAccessToken(input: {
  rawToken: string;
  acceptedTypes: UserAccessTokenType[];
}) {
  const tokenHash = hashToken(input.rawToken);

  const tokenRecord = await db.userAccessToken.findFirst({
    where: {
      tokenHash,
      tokenType: { in: input.acceptedTypes },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          suspendedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!tokenRecord || tokenRecord.user.suspendedAt) {
    return null;
  }

  return tokenRecord;
}

export async function markUserAccessTokenUsed(tokenId: string) {
  return db.userAccessToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
