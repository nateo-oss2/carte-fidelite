import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Trouve les clients dont le solde de points doit expirer : solde positif, et aucun achat
 * depuis plus de `expiryDays` (ou, si jamais d'achat, inscription plus ancienne que ce délai).
 */
async function findCustomersWithExpiredPoints(companyId: string, expiryDays: number) {
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const customers = await prisma.customer.findMany({
    where: { companyId, status: "ACTIVE", pointsBalance: { gt: 0 } },
    include: {
      transactions: {
        where: { type: "PURCHASE", status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return customers.filter((customer) => {
    const lastActivity = customer.transactions[0]?.createdAt ?? customer.createdAt;
    return lastActivity <= cutoff;
  });
}

interface ExpiryRunResult {
  companyId: string;
  companyName: string;
  expiredCount: number;
  totalPointsExpired: number;
}

/**
 * Remet à zéro le solde dépensable des clients inactifs depuis trop longtemps (mais jamais
 * lifetimePoints, qui reste l'historique permanent servant de base aux paliers de réduction —
 * voir schema.prisma). Chaque remise à zéro est journalisée comme une transaction EXPIRY,
 * jamais une simple modification silencieuse du solde.
 */
export async function runPointsExpiryForCompany(companyId: string): Promise<ExpiryRunResult | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.status !== "ACTIVE" || !company.pointsExpiryEnabled) {
    return null;
  }

  const expired = await findCustomersWithExpiredPoints(companyId, company.pointsExpiryDays);
  let totalPointsExpired = 0;

  for (const customer of expired) {
    const pointsDelta = -customer.pointsBalance;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { pointsBalance: 0 },
      });
      await tx.transaction.create({
        data: {
          companyId,
          customerId: customer.id,
          type: "EXPIRY",
          status: "COMPLETED",
          amount: new Prisma.Decimal(0),
          pointsDelta,
          balanceAfter: updated.pointsBalance,
          idempotencyKey: `points-expiry-${customer.id}-${new Date().toISOString().slice(0, 10)}`,
        },
      });
    });
    totalPointsExpired += -pointsDelta;
  }

  return { companyId, companyName: company.name, expiredCount: expired.length, totalPointsExpired };
}

/** Exécutée quotidiennement par le planificateur — parcourt toutes les entreprises actives. */
export async function runAllPointsExpiry(): Promise<ExpiryRunResult[]> {
  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE", pointsExpiryEnabled: true },
    select: { id: true },
  });

  const results: ExpiryRunResult[] = [];
  for (const company of companies) {
    const result = await runPointsExpiryForCompany(company.id);
    if (result) results.push(result);
  }
  return results;
}
