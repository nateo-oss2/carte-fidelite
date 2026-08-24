-- Retire le lien de scan public (scanToken) : le scan repasse par la session employé du
-- dashboard plutôt que par un lien séparé non authentifié.
DROP INDEX IF EXISTS "companies_scanToken_key";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "scanToken";
