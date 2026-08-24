import { prisma } from "../prisma";
import { generateOpaqueSecret, sha256Hex } from "../lib/crypto";

const RESET_TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1h

export type ResetActorType = "PLATFORM_ADMIN" | "EMPLOYEE";

/** Génère un jeton de réinitialisation, stocké hashé — retourné en clair une seule fois. */
export async function createPasswordResetToken(actorType: ResetActorType, actorId: string): Promise<string> {
  const rawToken = generateOpaqueSecret(20);
  await prisma.passwordResetToken.create({
    data: {
      actorType,
      actorId,
      tokenHash: sha256Hex(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_VALIDITY_MS),
    },
  });
  return rawToken;
}

/**
 * Valide et consomme un jeton (usage unique). Retourne l'id de l'acteur concerné si valide,
 * sinon null — jamais ne révèle si le jeton existait mais a expiré/déjà été utilisé.
 */
export async function consumePasswordResetToken(actorType: ResetActorType, rawToken: string): Promise<string | null> {
  const tokenHash = sha256Hex(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.actorType !== actorType || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.actorId;
}
