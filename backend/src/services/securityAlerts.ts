import { prisma } from "../prisma";
import type { Prisma, SecurityAlertSeverity, SecurityAlertType } from "@prisma/client";

const COOLDOWN_MINUTES = 15;

/**
 * Crée une alerte, sauf s'il en existe déjà une non résolue du même type (et de la même
 * entreprise) créée récemment — évite de spammer le dashboard admin avec la même alerte
 * répétée à chaque nouvel événement suspect tant que personne ne l'a traitée.
 */
async function createAlertIfNotRecent(
  type: SecurityAlertType,
  companyId: string | null,
  severity: SecurityAlertSeverity,
  message: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);
  const recent = await prisma.securityAlert.findFirst({
    where: { type, companyId, resolved: false, createdAt: { gte: since } },
  });
  if (recent) return;

  await prisma.securityAlert.create({ data: { type, companyId, severity, message, metadata } });
}

/** Repère un terminal qui accumule des scans de tokens invalides — signe d'une attaque par essais. */
export async function checkAndAlertRapidScanFailures(companyId: string, terminalId: string): Promise<void> {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: { companyId, action: "SCAN_TOKEN_INVALID", createdAt: { gte: since }, metadata: { path: ["terminalId"], equals: terminalId } },
  });

  if (count >= 10) {
    await createAlertIfNotRecent(
      "RAPID_SCAN_FAILURES",
      companyId,
      "HIGH",
      `Un terminal a généré ${count} tentatives de scan invalides en 5 minutes.`,
      { terminalId, count },
    );
  }
}

/** Un client qui enchaîne un nombre anormal de transactions en peu de temps. */
export async function checkAndAlertRapidTransactions(companyId: string, customerId: string): Promise<void> {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const count = await prisma.transaction.count({
    where: { companyId, customerId, createdAt: { gte: since } },
  });

  if (count >= 8) {
    await createAlertIfNotRecent(
      "RAPID_TRANSACTIONS",
      companyId,
      "MEDIUM",
      `Un client a généré ${count} transactions en 5 minutes.`,
      { customerId, count },
    );
  }
}

/** Un montant d'achat significativement plus élevé que la moyenne habituelle de l'entreprise. */
export async function checkAndAlertUnusualAmount(companyId: string, amount: Prisma.Decimal): Promise<void> {
  const agg = await prisma.transaction.aggregate({
    where: { companyId, type: "PURCHASE", status: "COMPLETED" },
    _avg: { amount: true },
    _count: true,
  });

  const avg = agg._avg.amount;
  // Pas assez d'historique pour juger de ce qui est "inhabituel" — on ne déclenche rien.
  if (!avg || agg._count < 10) return;

  const threshold = avg.mul(5).add(50); // 5x la moyenne + marge, pour éviter les faux positifs sur de petites moyennes
  if (amount.greaterThan(threshold)) {
    await createAlertIfNotRecent(
      "UNUSUAL_AMOUNT",
      companyId,
      "MEDIUM",
      `Une transaction de ${amount.toString()}€ dépasse largement la moyenne habituelle (${avg.toFixed(2)}€).`,
      { amount: amount.toString(), average: avg.toString() },
    );
  }
}

/** Un token révoqué présenté au scan — tentative d'utilisation d'une carte invalidée. */
export async function alertRevokedTokenAttempt(companyId: string, terminalId: string): Promise<void> {
  await createAlertIfNotRecent(
    "REVOKED_TOKEN_ATTEMPT",
    companyId,
    "HIGH",
    "Tentative de scan avec un token révoqué.",
    { terminalId },
  );
}

/** Échecs de connexion répétés — admin plateforme ou employé d'entreprise. */
export async function checkAndAlertLoginFailures(
  actorKind: "ADMIN" | "EMPLOYEE",
  identifier: string,
  companyId: string | null = null,
): Promise<void> {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const action = actorKind === "ADMIN" ? "ADMIN_LOGIN_FAILED" : "EMPLOYEE_LOGIN_FAILED";
  const count = await prisma.auditLog.count({
    where: {
      companyId,
      action,
      createdAt: { gte: since },
      metadata: { path: ["email"], equals: identifier },
    },
  });

  if (count >= 5) {
    await createAlertIfNotRecent(
      "EXCESSIVE_LOGIN_FAILURES",
      companyId,
      "HIGH",
      `${count} échecs de connexion en 15 minutes pour ${identifier}.`,
      { identifier, count, actorKind },
    );
  }
}
