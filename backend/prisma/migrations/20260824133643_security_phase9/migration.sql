-- CreateEnum
CREATE TYPE "ResetActorType" AS ENUM ('PLATFORM_ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "SecurityAlertType" AS ENUM ('RAPID_SCAN_FAILURES', 'RAPID_TRANSACTIONS', 'UNUSUAL_AMOUNT', 'REVOKED_TOKEN_ATTEMPT', 'EXCESSIVE_LOGIN_FAILURES');

-- CreateEnum
CREATE TYPE "SecurityAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "actorType" "ResetActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "type" "SecurityAlertType" NOT NULL,
    "severity" "SecurityAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_actorType_actorId_idx" ON "password_reset_tokens"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "security_alerts_companyId_resolved_createdAt_idx" ON "security_alerts"("companyId", "resolved", "createdAt");

-- AddForeignKey
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
