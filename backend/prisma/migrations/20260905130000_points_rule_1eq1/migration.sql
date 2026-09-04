-- Retour à 1€ dépensé = 1 point, pour toutes les entreprises (existantes et nouvelles).
ALTER TABLE "companies" ALTER COLUMN "pointsPerCurrencyUnit" SET DEFAULT 1;
UPDATE "companies" SET "pointsPerCurrencyUnit" = 1;
