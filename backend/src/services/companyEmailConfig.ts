import { prisma } from "../prisma";
import { encryptToken, decryptToken } from "../lib/tokenEncryption";

export interface EmailConfigInput {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
}

export async function getEmailConfig(companyId: string) {
  return prisma.companyEmailConfig.findUnique({ where: { companyId } });
}

/**
 * Config Resend partagée par la plateforme (PLATFORM_RESEND_API_KEY / PLATFORM_EMAIL_FROM_ADDRESS
 * dans les variables d'environnement) — utilisée par défaut pour toute entreprise qui n'a pas
 * configuré son propre compte Resend. Évite à chaque entreprise (souvent non technique) de devoir
 * créer un compte et vérifier un domaine juste pour que les e-mails automatiques fonctionnent.
 */
function getPlatformEmailConfig() {
  const apiKey = process.env.PLATFORM_RESEND_API_KEY;
  const fromAddress = process.env.PLATFORM_EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) return null;
  return {
    smtpHost: "resend",
    smtpPort: 443,
    smtpSecure: true,
    smtpUser: "resend",
    fromAddress,
    smtpPassword: apiKey,
  };
}

/** Le compte partagé de la plateforme est-il configuré ? Jamais la clé elle-même. */
export function isPlatformEmailConfigured(): boolean {
  return getPlatformEmailConfig() !== null;
}

/**
 * Renvoie la config prête à l'emploi (mot de passe déchiffré) — jamais exposée à un client HTTP.
 * Priorité au compte Resend propre de l'entreprise s'il existe (adresse personnalisée), sinon
 * repli sur le compte partagé de la plateforme.
 */
export async function getDecryptedEmailConfig(companyId: string) {
  const config = await getEmailConfig(companyId);
  if (config) {
    return { ...config, smtpPassword: decryptToken(config.smtpPasswordEncrypted) };
  }
  return getPlatformEmailConfig();
}

/** Crée ou remplace la configuration e-mail d'une entreprise. */
export async function upsertEmailConfig(companyId: string, input: EmailConfigInput) {
  const smtpPasswordEncrypted = encryptToken(input.smtpPassword);
  return prisma.companyEmailConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      smtpUser: input.smtpUser,
      smtpPasswordEncrypted,
      fromAddress: input.fromAddress,
    },
    update: {
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      smtpUser: input.smtpUser,
      smtpPasswordEncrypted,
      fromAddress: input.fromAddress,
    },
  });
}

export async function deleteEmailConfig(companyId: string) {
  await prisma.companyEmailConfig.deleteMany({ where: { companyId } });
}
