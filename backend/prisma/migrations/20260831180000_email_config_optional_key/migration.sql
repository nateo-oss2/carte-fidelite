-- Une entreprise peut désormais renseigner uniquement son adresse d'expédition, sans sa propre
-- clé API : l'envoi utilisera alors le compte Resend partagé de la plateforme, avec cette
-- adresse-ci quand même (voir services/companyEmailConfig.ts).
ALTER TABLE "company_email_configs" ALTER COLUMN "smtpHost" DROP NOT NULL;
ALTER TABLE "company_email_configs" ALTER COLUMN "smtpPort" DROP NOT NULL;
ALTER TABLE "company_email_configs" ALTER COLUMN "smtpSecure" DROP NOT NULL;
ALTER TABLE "company_email_configs" ALTER COLUMN "smtpUser" DROP NOT NULL;
ALTER TABLE "company_email_configs" ALTER COLUMN "smtpPasswordEncrypted" DROP NOT NULL;
