import { prisma } from "../prisma";
import { generateOpaqueSecret, sha256Hex } from "../lib/crypto";
import { encryptToken, decryptToken } from "../lib/tokenEncryption";

/**
 * Génère un token de fidélité brut : 20 octets aléatoires (160 bits d'entropie),
 * encodés en Base32 alphanumérique majuscule — compatible Code128, illisible/imprévisible.
 * C'est CETTE valeur qui est encodée dans le code-barres du pass Wallet.
 */
export function generateRawToken(): string {
  return generateOpaqueSecret(20);
}

/** Hash irréversible utilisé pour toute vérification au scan — jamais pour reconstruire le token. */
export function hashToken(rawToken: string): string {
  return sha256Hex(rawToken);
}

/**
 * Crée le premier token actif d'un client (à l'inscription).
 * Retourne le token brut UNE SEULE FOIS — à embarquer immédiatement dans le pass Wallet.
 */
export async function issueInitialToken(customerId: string): Promise<string> {
  const rawToken = generateRawToken();
  await prisma.customerToken.create({
    data: {
      customerId,
      tokenHash: hashToken(rawToken),
      encryptedToken: encryptToken(rawToken),
      status: "ACTIVE",
    },
  });
  return rawToken;
}

/**
 * Rotation de token : révoque l'ancien token actif (s'il existe) et en émet un nouveau.
 * Utilisé en cas de compromission suspectée, ou lorsqu'un client rejoint alors qu'il a déjà une carte.
 */
export async function rotateToken(customerId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // La valeur chiffrée d'un token révoqué est effacée : elle ne sert plus à rien une fois
    // le token invalidé, autant réduire la fenêtre d'exposition.
    await tx.customerToken.updateMany({
      where: { customerId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), encryptedToken: null },
    });

    const rawToken = generateRawToken();
    await tx.customerToken.create({
      data: {
        customerId,
        tokenHash: hashToken(rawToken),
        encryptedToken: encryptToken(rawToken),
        status: "ACTIVE",
      },
    });
    return rawToken;
  });
}

/** Révoque le token actif d'un client sans en émettre un nouveau (carte perdue/volée signalée). */
export async function revokeActiveToken(customerId: string): Promise<void> {
  await prisma.customerToken.updateMany({
    where: { customerId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date(), encryptedToken: null },
  });
}

/**
 * Vérifie un token présenté au scan (valeur brute lue dans le code-barres).
 * Ne fait JAMAIS confiance à un customerId envoyé par le client : c'est ce lookup,
 * exclusivement côté serveur, qui détermine l'identité du porteur.
 * Un token révoqué ou inconnu est systématiquement rejeté.
 */
export async function resolveCustomerByToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.customerToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });

  if (!record || record.status !== "ACTIVE") {
    return null;
  }
  if (record.customer.status !== "ACTIVE") {
    return null;
  }
  return record.customer;
}

/**
 * Réservé à la détection anti-fraude interne : distingue "token révoqué" de "token inconnu"
 * — jamais utilisé pour la réponse renvoyée au terminal (qui doit rester identique dans les
 * deux cas, pour ne pas donner d'oracle à un attaquant).
 */
export async function wasTokenRevoked(rawToken: string): Promise<boolean> {
  const record = await prisma.customerToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  return record?.status === "REVOKED";
}

/**
 * Résout le lien "voir ma fiche client" — un secret distinct du token du code-barres (celui-ci
 * ne doit jamais changer, il est encodé dans le pass Wallet réel). À la toute première
 * consultation, ce lien est régénéré une fois : un lien vu/partagé avant cette rotation cesse de
 * fonctionner, la nouvelle valeur brute est renvoyée pour que la page l'affiche/l'enregistre.
 * Les consultations suivantes n'entraînent plus de rotation.
 */
export async function resolveCustomerByCardViewToken(
  rawToken: string,
): Promise<{ customer: NonNullable<Awaited<ReturnType<typeof prisma.customer.findUnique>>>; newToken: string | null } | null> {
  const tokenHash = sha256Hex(rawToken);
  const customer = await prisma.customer.findUnique({ where: { cardViewTokenHash: tokenHash } });
  if (!customer || customer.status !== "ACTIVE") {
    return null;
  }

  if (customer.cardViewTokenRotated) {
    return { customer, newToken: null };
  }

  const newRawToken = generateOpaqueSecret();
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { cardViewTokenHash: sha256Hex(newRawToken), cardViewTokenRotated: true },
  });
  return { customer: updated, newToken: newRawToken };
}

/**
 * Récupère la valeur en clair du token actif d'un client — réservé exclusivement à la
 * reconstruction d'un pass Wallet (Apple/Google) à leur demande, jamais à un usage de scan
 * ou à une exposition sur une route publique.
 */
export async function getActiveTokenPlaintext(customerId: string): Promise<string | null> {
  const record = await prisma.customerToken.findFirst({
    where: { customerId, status: "ACTIVE" },
  });
  if (!record?.encryptedToken) {
    return null;
  }
  return decryptToken(record.encryptedToken);
}
