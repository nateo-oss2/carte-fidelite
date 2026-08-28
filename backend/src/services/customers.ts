import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { generateLoyaltyNumber } from "./loyaltyNumber";
import { issueInitialToken, rotateToken } from "./tokens";
import { recordAuditLog } from "./auditLog";
import { generateOpaqueSecret, sha256Hex } from "../lib/crypto";
import { listRewards } from "./rewards";
import { listDiscountTiers, resolveApplicableTier } from "./discountTiers";

export interface JoinInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  /** Numéro de fidélité du parrain — client existant de la même entreprise, optionnel. */
  referralCode?: string;
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
  /** true si un code de parrainage valide a été appliqué (bonus crédité aux deux). */
  referralApplied: boolean;
  /** Jeton brut du lien "voir ma fiche" — distinct du token du code-barres, renvoyé une seule fois ici. */
  cardViewToken: string;
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
    const rawCardViewToken = generateOpaqueSecret();
    await prisma.customer.update({
      where: { id: existing.id },
      data: { cardViewTokenHash: sha256Hex(rawCardViewToken), cardViewTokenRotated: false },
    });
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
      referralApplied: false,
      cardViewToken: rawCardViewToken,
    };
  }

  // Le parrain doit être un client déjà actif de CETTE entreprise — jamais d'une autre, jamais
  // un compte bloqué. Une référence invalide/inconnue est simplement ignorée (pas d'erreur
  // bloquante pour l'inscription : le client obtient sa carte dans tous les cas).
  const referrer = input.referralCode
    ? await prisma.customer.findUnique({ where: { loyaltyNumber: input.referralCode.trim() } })
    : null;
  const validReferrer = referrer && referrer.companyId === companyId && referrer.status === "ACTIVE" ? referrer : null;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const referralBonus = company?.referralBonusPoints ?? 0;

  for (let attempt = 0; attempt < MAX_LOYALTY_NUMBER_ATTEMPTS; attempt++) {
    const rawCardViewToken = generateOpaqueSecret();
    try {
      const customer = await prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            companyId,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            loyaltyNumber: generateLoyaltyNumber(),
            pointsBalance: 0,
            referredById: validReferrer?.id ?? null,
            cardViewTokenHash: sha256Hex(rawCardViewToken),
          },
        });

        // Premier point offert à l'inscription — toujours, indépendamment du parrainage.
        const withSignupBonus = await tx.customer.update({
          where: { id: created.id },
          data: { pointsBalance: { increment: 1 }, lifetimePoints: { increment: 1 } },
        });
        await tx.transaction.create({
          data: {
            companyId,
            customerId: created.id,
            type: "BONUS",
            status: "COMPLETED",
            amount: new Prisma.Decimal(0),
            pointsDelta: 1,
            balanceAfter: withSignupBonus.pointsBalance,
            idempotencyKey: `signup-bonus-${created.id}`,
          },
        });

        let finalBalance = withSignupBonus.pointsBalance;

        if (validReferrer && referralBonus > 0) {
          const withReferralBonus = await tx.customer.update({
            where: { id: created.id },
            data: { pointsBalance: { increment: referralBonus }, lifetimePoints: { increment: referralBonus } },
          });
          finalBalance = withReferralBonus.pointsBalance;
          await tx.transaction.create({
            data: {
              companyId,
              customerId: created.id,
              type: "BONUS",
              status: "COMPLETED",
              amount: new Prisma.Decimal(0),
              pointsDelta: referralBonus,
              balanceAfter: finalBalance,
              idempotencyKey: `referral-filleul-${created.id}`,
            },
          });

          const updatedReferrer = await tx.customer.update({
            where: { id: validReferrer.id },
            data: { pointsBalance: { increment: referralBonus }, lifetimePoints: { increment: referralBonus } },
          });
          await tx.transaction.create({
            data: {
              companyId,
              customerId: validReferrer.id,
              type: "BONUS",
              status: "COMPLETED",
              amount: new Prisma.Decimal(0),
              pointsDelta: referralBonus,
              balanceAfter: updatedReferrer.pointsBalance,
              idempotencyKey: `referral-parrain-${created.id}`,
            },
          });
        }

        return { ...created, pointsBalance: finalBalance };
      });

      const rawToken = await issueInitialToken(customer.id);

      await recordAuditLog({
        companyId,
        actorType: "CUSTOMER",
        action: "CUSTOMER_CREATED",
        targetType: "Customer",
        targetId: customer.id,
        ipAddress,
        metadata: validReferrer ? { referredById: validReferrer.id } : undefined,
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
        referralApplied: Boolean(validReferrer && referralBonus > 0),
        cardViewToken: rawCardViewToken,
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

/**
 * Clients dont c'est l'anniversaire aujourd'hui (jour + mois, année ignorée) — pour le widget
 * du dashboard entreprise qui rappelle à l'employé d'envoyer le message cadeau du jour.
 */
export async function findTodaysBirthdays(companyId: string) {
  // "Aujourd'hui" au sens calendaire France (pas le fuseau du serveur, souvent UTC en
  // production) — sinon la comparaison dérive de plusieurs heures selon l'heure d'été/hiver.
  const parisParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const todayMonth = Number(parisParts.find((p) => p.type === "month")!.value) - 1;
  const todayDate = Number(parisParts.find((p) => p.type === "day")!.value);

  const customers = await prisma.customer.findMany({
    where: { companyId, status: "ACTIVE", dateOfBirth: { not: null }, email: { not: null } },
    select: { id: true, firstName: true, lastName: true, loyaltyNumber: true, email: true, dateOfBirth: true },
  });

  // dateOfBirth est une date sans heure (ex: "1995-08-27"), stockée par Prisma à minuit UTC —
  // getUTCMonth/getUTCDate redonnent exactement le jour saisi, sans dérive de fuseau.
  return customers
    .filter((c) => c.dateOfBirth!.getUTCMonth() === todayMonth && c.dateOfBirth!.getUTCDate() === todayDate)
    .map(({ dateOfBirth: _dateOfBirth, ...rest }) => rest);
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

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  let availableRewards: Array<{ id: string; name: string; pointsCost: number }> = [];
  let currentDiscountPercent: string | null = null;

  if (company!.programType === "POINTS") {
    const rewards = await listRewards(companyId, true);
    availableRewards = rewards
      .filter((r) => r.pointsCost <= customer.pointsBalance)
      .map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost }));
  } else {
    const tiers = await listDiscountTiers(companyId);
    const tier = resolveApplicableTier(tiers, customer.lifetimePoints);
    currentDiscountPercent = tier ? tier.discountPercent.toString() : null;
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
    programType: company!.programType,
    availableRewards,
    currentDiscountPercent,
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
