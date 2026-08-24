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

/** Renvoie la config prête à l'emploi (mot de passe déchiffré) — jamais exposée à un client HTTP. */
export async function getDecryptedEmailConfig(companyId: string) {
  const config = await getEmailConfig(companyId);
  if (!config) return null;
  return { ...config, smtpPassword: decryptToken(config.smtpPasswordEncrypted) };
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
