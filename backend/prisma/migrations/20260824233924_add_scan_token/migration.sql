-- AlterTable
ALTER TABLE "companies" ADD COLUMN "scanToken" TEXT;

-- Backfill: chaque entreprise existante reçoit un jeton unique aléatoire (pas besoin
-- d'extension pgcrypto : md5 suffit ici, ce n'est pas un secret cryptographique fort,
-- juste un identifiant d'URL non devinable).
UPDATE "companies"
SET "scanToken" = 'st_' || md5(random()::text || clock_timestamp()::text || id)
WHERE "scanToken" IS NULL;

-- MakeRequired + Unique
ALTER TABLE "companies" ALTER COLUMN "scanToken" SET NOT NULL;
CREATE UNIQUE INDEX "companies_scanToken_key" ON "companies"("scanToken");
