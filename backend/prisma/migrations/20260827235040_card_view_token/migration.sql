ALTER TABLE "customers" ADD COLUMN "cardViewTokenHash" TEXT;
ALTER TABLE "customers" ADD COLUMN "cardViewTokenRotated" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "customers_cardViewTokenHash_key" ON "customers"("cardViewTokenHash");
