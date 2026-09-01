import { prisma } from "../prisma";
import { encryptToken, decryptToken } from "../lib/tokenEncryption";

export interface EmailConfigInput {
  fromAddress: string;
  /**
   * Optionnelle : quand absente, l'envoi utilise le compte Resend partagé de la plateforme,
   * mais AVEC cette adresse d'expédition-ci (voir getDecryptedEmailConfig ci-dessous) — une
   * entreprise n'a besoin de son propre compte Resend que si elle veut sa propre clé.
   */
  smtpPassword?: string;
}

export async function getEmailConfig(companyId: string) {
  return prisma.companyEmailConfig.findUnique({ where: { companyId } });
}

/**
 * Config Resend partagée par la plateforme (PLATFORM_RESEND_API_KEY / PLATFORM_EMAIL_FROM_ADDRESS
 * dans les variables d'environnement) — la seule clé que la plateforme elle-même doit posséder.
 * Utilisée pour toute entreprise qui n'a pas sa propre clé, avec sa propre adresse si elle en a
 * renseigné une (voir getDecryptedEmailConfig).
 */
function getPlatformResendApiKey(): string | null {
  return process.env.PLATFORM_RESEND_API_KEY ?? null;
}

/**
 * Le compte partagé de la plateforme est-il configuré ? Jamais l'adresse ni la clé — une
 * entreprise ne doit voir dans son dashboard que SA PROPRE adresse d'expédition si elle en a
 * renseigné une, jamais celle du compte partagé utilisé en coulisses.
 */
export function isPlatformEmailConfigured(): boolean {
  return getPlatformResendApiKey() !== null && Boolean(process.env.PLATFORM_EMAIL_FROM_ADDRESS);
}

/**
 * Renvoie la config prête à l'emploi (clé déchiffrée) — jamais exposée à un client HTTP.
 * Trois cas, du plus simple au plus autonome :
 *  1. Rien de configuré pour cette entreprise → clé ET adresse du compte partagé.
 *  2. Adresse renseignée mais pas de clé propre → adresse de l'entreprise + clé du compte
 *     partagé (ne fonctionnera vraiment que si cette adresse est sur un domaine vérifié sur
 *     le compte partagé, ou `onboarding@resend.dev` — limite imposée par Resend lui-même).
 *  3. Adresse ET clé propres renseignées → entièrement le compte Resend de l'entreprise.
 */
export async function getDecryptedEmailConfig(companyId: string) {
  const config = await getEmailConfig(companyId);

  if (config?.smtpPasswordEncrypted) {
    return { fromAddress: config.fromAddress, smtpPassword: decryptToken(config.smtpPasswordEncrypted) };
  }

  const platformApiKey = getPlatformResendApiKey();
  if (!platformApiKey) return null;

  const fromAddress = config?.fromAddress ?? process.env.PLATFORM_EMAIL_FROM_ADDRESS;
  if (!fromAddress) return null;

  return { fromAddress, smtpPassword: platformApiKey };
}

/** Crée ou remplace la configuration e-mail d'une entreprise. */
export async function upsertEmailConfig(companyId: string, input: EmailConfigInput) {
  const smtpPasswordEncrypted = input.smtpPassword ? encryptToken(input.smtpPassword) : null;
  return prisma.companyEmailConfig.upsert({
    where: { companyId },
    create: { companyId, fromAddress: input.fromAddress, smtpPasswordEncrypted },
    update: { fromAddress: input.fromAddress, smtpPasswordEncrypted },
  });
}

export async function deleteEmailConfig(companyId: string) {
  await prisma.companyEmailConfig.deleteMany({ where: { companyId } });
}
