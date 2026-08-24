/*
  Warnings:

  - You are about to drop the column `applePushTokens` on the `wallet_passes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wallet_passes" DROP COLUMN "applePushTokens";

-- CreateTable
CREATE TABLE "apple_device_registrations" (
    "id" TEXT NOT NULL,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "walletPassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_device_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apple_device_registrations_walletPassId_idx" ON "apple_device_registrations"("walletPassId");

-- CreateIndex
CREATE UNIQUE INDEX "apple_device_registrations_deviceLibraryIdentifier_walletPa_key" ON "apple_device_registrations"("deviceLibraryIdentifier", "walletPassId");

-- AddForeignKey
ALTER TABLE "apple_device_registrations" ADD CONSTRAINT "apple_device_registrations_walletPassId_fkey" FOREIGN KEY ("walletPassId") REFERENCES "wallet_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
