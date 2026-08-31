import { prisma } from "../prisma";
import { encryptToken, decryptToken } from "../lib/tokenEncryption";

export interface PosApiCredentialInput {
  providerName: string;
  apiKey: string;
  apiBaseUrl?: string;
}

/** Ne renvoie JAMAIS la clé elle-même — seulement de quoi confirmer ce qui est configuré. */
export async function getPosApiCredentialStatus(companyId: string) {
  return prisma.posApiCredential.findUnique({
    where: { companyId },
    select: { providerName: true, apiBaseUrl: true, connectedAt: true, updatedAt: true },
  });
}

/** Crée ou remplace les identifiants d'accès à l'API caisse d'une entreprise. */
export async function upsertPosApiCredential(companyId: string, input: PosApiCredentialInput) {
  const apiKeyEncrypted = encryptToken(input.apiKey);
  return prisma.posApiCredential.upsert({
    where: { companyId },
    create: {
      companyId,
      providerName: input.providerName,
      apiKeyEncrypted,
      apiBaseUrl: input.apiBaseUrl ?? null,
    },
    update: {
      providerName: input.providerName,
      apiKeyEncrypted,
      apiBaseUrl: input.apiBaseUrl ?? null,
    },
  });
}

export async function deletePosApiCredential(companyId: string): Promise<void> {
  await prisma.posApiCredential.deleteMany({ where: { companyId } });
}

/**
 * Réservé à un futur adaptateur spécifique à un logiciel de caisse (Zelty, Lightspeed...) —
 * jamais exposé sur une route HTTP. Tant qu'aucun adaptateur n'existe, rien n'appelle cette
 * fonction : la clé reste stockée mais inactive.
 */
export async function getDecryptedPosApiCredential(companyId: string) {
  const config = await prisma.posApiCredential.findUnique({ where: { companyId } });
  if (!config) return null;
  return { ...config, apiKey: decryptToken(config.apiKeyEncrypted) };
}
