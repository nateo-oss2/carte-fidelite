-- 2€ dépensés = 1 point, désormais le taux par défaut (nouvelles entreprises)
-- ET la valeur appliquée à toutes les entreprises existantes.
ALTER TABLE "companies" ALTER COLUMN "pointsPerCurrencyUnit" SET DEFAULT 0.5;

UPDATE "companies" SET "pointsPerCurrencyUnit" = 0.5;
