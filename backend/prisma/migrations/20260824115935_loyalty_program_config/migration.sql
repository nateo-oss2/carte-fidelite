-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('POINTS', 'DISCOUNT');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'REDEMPTION';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "programType" "ProgramType" NOT NULL DEFAULT 'POINTS';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "lifetimePoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "rewardId" TEXT;

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_tiers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "thresholdPoints" INTEGER NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rewards_companyId_idx" ON "rewards"("companyId");

-- CreateIndex
CREATE INDEX "discount_tiers_companyId_idx" ON "discount_tiers"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_tiers_companyId_thresholdPoints_key" ON "discount_tiers"("companyId", "thresholdPoints");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_tiers" ADD CONSTRAINT "discount_tiers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
