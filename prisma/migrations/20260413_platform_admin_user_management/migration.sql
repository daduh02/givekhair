-- AlterTable
ALTER TABLE "User"
ADD COLUMN "invitedAt" TIMESTAMP(3),
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT,
ADD COLUMN "lastAccessChangeAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "UserAccessTokenType" AS ENUM ('INVITE', 'PASSWORD_SETUP', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "UserAccessAuditAction" AS ENUM (
  'USER_INVITED',
  'USER_ROLE_CHANGED',
  'USER_SUSPENDED',
  'USER_UNSUSPENDED',
  'PASSWORD_SETUP_TRIGGERED',
  'PASSWORD_RESET_TRIGGERED'
);

-- CreateTable
CREATE TABLE "UserAccessToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenType" "UserAccessTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessToken_tokenHash_key" ON "UserAccessToken"("tokenHash");
CREATE INDEX "UserAccessToken_userId_tokenType_createdAt_idx" ON "UserAccessToken"("userId", "tokenType", "createdAt");
CREATE INDEX "UserAccessToken_expiresAt_usedAt_idx" ON "UserAccessToken"("expiresAt", "usedAt");

-- CreateTable
CREATE TABLE "UserAccessAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" "UserAccessAuditAction" NOT NULL,
  "reason" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAccessAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessAuditLog_actorUserId_createdAt_idx" ON "UserAccessAuditLog"("actorUserId", "createdAt");
CREATE INDEX "UserAccessAuditLog_targetUserId_createdAt_idx" ON "UserAccessAuditLog"("targetUserId", "createdAt");
CREATE INDEX "UserAccessAuditLog_action_createdAt_idx" ON "UserAccessAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "UserAccessToken"
ADD CONSTRAINT "UserAccessToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessToken"
ADD CONSTRAINT "UserAccessToken_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessAuditLog"
ADD CONSTRAINT "UserAccessAuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessAuditLog"
ADD CONSTRAINT "UserAccessAuditLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
