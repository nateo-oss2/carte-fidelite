-- Colonnes mortes depuis toujours (Resend s'utilise via son API HTTP, jamais SMTP) —
-- conservées jusqu'ici par compatibilité de schéma, supprimées maintenant qu'on nettoie ce modèle.
ALTER TABLE "company_email_configs" DROP COLUMN "smtpHost";
ALTER TABLE "company_email_configs" DROP COLUMN "smtpPort";
ALTER TABLE "company_email_configs" DROP COLUMN "smtpSecure";
ALTER TABLE "company_email_configs" DROP COLUMN "smtpUser";
