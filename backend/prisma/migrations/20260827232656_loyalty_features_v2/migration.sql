-- Nouvel enum : position du logo sur la carte Wallet
CREATE TYPE "CardLogoPosition" AS ENUM ('CENTER', 'TOP', 'SIDE');

-- Nouvelles valeurs de TransactionType : bonus (inscription/parrainage) et expiration
ALTER TYPE "TransactionType" ADD VALUE 'BONUS';
ALTER TYPE "TransactionType" ADD VALUE 'EXPIRY';

-- Company : personnalisation carte, parrainage, heures creuses, expiration des points
ALTER TABLE "companies" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "companies" ADD COLUMN "logoPosition" "CardLogoPosition" NOT NULL DEFAULT 'CENTER';
ALTER TABLE "companies" ALTER COLUMN "inactivityThresholdDays" SET DEFAULT 60;
ALTER TABLE "companies" ADD COLUMN "referralBonusPoints" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "companies" ADD COLUMN "offPeakBonusEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "offPeakStartHour" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "companies" ADD COLUMN "offPeakEndHour" INTEGER NOT NULL DEFAULT 19;
ALTER TABLE "companies" ADD COLUMN "pointsExpiryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "companies" ADD COLUMN "pointsExpiryDays" INTEGER NOT NULL DEFAULT 365;

-- Customer : date de naissance + parrainage
ALTER TABLE "customers" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "referredById" TEXT;
ALTER TABLE "customers" ADD CONSTRAINT "customers_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
