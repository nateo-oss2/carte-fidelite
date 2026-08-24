import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { generateLoyaltyNumber } from "./loyaltyNumber";
import { issueInitialToken, rotateToken } from "./tokens";
import { recordAuditLog } from "./auditLog";

export interface JoinInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface JoinResult {
  customer: {
    id: string;
    companyId: string;
    firstName: string | null;
    lastName: string | null;
    loyaltyNumber: string;
    pointsBalance: number;
  };
  /** Token brut à embarquer immédiatement dans le pass Wallet — jamais renvoyé une seconde fois. */
  rawToken: string;
  /** true si le client avait déjà une carte pour cette entreprise (son token a été régénéré). */
  alreadyEnrolled: boolean;
}

const MAX_LOYALTY_NUMBER_ATTEMPTS = 5;

/**
 * Inscription d'un client au programme de fidélité d'une entreprise (flux QR code → formulaire).
 * - Ne crée jamais un deuxième compte pour un client déjà inscrit (dédoublonnage par e-mail) :
 *   dans ce cas, son token est simplement régénéré (équivalent à une récupération de carte).
 * - Le solde initial est toujours 0.
 */
export async function joinCompanyProgram(
  companyId: string,
  input: JoinInput,
  ipAddress: string | null,
): Promise<JoinResult> {
  const existing = input.email
    ? await prisma.customer.findUnique({
        where: { companyId_email: { companyId, email: input.email } },
      })
    : null;

  if (existing) {
    const rawToken = await rotateToken(existing.id);
    await recordAuditLog({
      companyId,
      actorType: "CUSTOMER",
      action: "CUSTOMER_TOKEN_ROTATED_ON_REJOIN",
      targetType: "Customer",
      targetId: existing.id,
      ipAddress,
    });
    return {
      customer: {
        id: existing.id,
        companyId: existing.companyId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        loyaltyNumber: existing.loyaltyNumber,
        pointsBalance: existing.pointsBalance,
      },
      rawToken,
      alreadyEnrolled: true,
    };
  }

  for (let attempt = 0; attempt < MAX_LOYALTY_NUMBER_ATTEMPTS; attempt++) {
    try {
      const customer = await prisma.customer.create({
        data: {
          companyId,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          loyaltyNumber: generateLoyaltyNumber(),
          pointsBalance: 0,
        },
      });

      const rawToken = await issueInitialToken(customer.id);

      await recordAuditLog({
        companyId,
        actorType: "CUSTOMER",
        action: "CUSTOMER_CREATED",
        targetType: "Customer",
        targetId: customer.id,
        ipAddress,
      });

      return {
        customer: {
          id: customer.id,
          companyId: customer.companyId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          loyaltyNumber: customer.loyaltyNumber,
          pointsBalance: customer.pointsBalance,
        },
        rawToken,
        alreadyEnrolled: false,
      };
    } catch (error) {
      const isUniqueLoyaltyNumberClash =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | undefined)?.includes("loyaltyNumber");

      if (!isUniqueLoyaltyNumberClash) {
        throw error;
      }
      // Collision improbable sur le numéro de fidélité généré aléatoirement : on retente.
    }
  }

  throw new Error("Impossible de générer un numéro de fidélité unique après plusieurs tentatives.");
}

/**
 * Liste/recherche les clients d'une entreprise — pour le dashboard entreprise, avec un suivi
 * d'achat (nombre d'achats, date du dernier achat) pour repérer les clients inactifs.
 */
export async function listCustomers(companyId: string, search?: string) {
  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { loyaltyNumber: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      tokens: { where: { status: "ACTIVE" }, select: { id: true } },
      transactions: {
        where: { type: "PURCHASE", status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      _count: {
        select: { transactions: { where: { type: "PURCHASE", status: "COMPLETED" } } },
      },
    },
  });

  return customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    purchaseCount: c._count.transactions,
    lastPurchaseAt: c.transactions[0]?.createdAt ?? null,
    loyaltyNumber: c.loyaltyNumber,
    pointsBalance: c.pointsBalance,
    status: c.status,
    hasActiveCard: c.tokens.length > 0,
    createdAt: c.createdAt,
  }));
}

/** Fiche détaillée d'un client — identité, solde, statut de carte, historique récent. */
export async function getCustomerDetail(companyId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      tokens: { where: { status: "ACTIVE" }, select: { id: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          pointsDelta: true,
          balanceAfter: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer || customer.companyId !== companyId) {
    return null;
  }

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    loyaltyNumber: customer.loyaltyNumber,
    pointsBalance: customer.pointsBalance,
    lifetimePoints: customer.lifetimePoints,
    status: customer.status,
    hasActiveCard: customer.tokens.length > 0,
    createdAt: customer.createdAt,
    recentTransactions: customer.transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: tx.amount.toString(),
      pointsDelta: tx.pointsDelta,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt,
    })),
  };
}
