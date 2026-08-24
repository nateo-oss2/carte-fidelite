import { Prisma, type Transaction } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../lib/httpError";
import { isUniqueConstraintViolation } from "../lib/prismaErrors";
import { checkAndAlertRapidTransactions, checkAndAlertUnusualAmount } from "./securityAlerts";

interface RecordPurchaseInput {
  companyId: string;
  customerId: string;
  /** Montant en euros, chaîne décimale ("37.00") — jamais un float JS, pour éviter les erreurs d'arrondi. */
  amount: string;
  terminalId?: string | null;
  employeeId?: string | null;
  idempotencyKey: string;
}

interface RedeemRewardInput {
  companyId: string;
  customerId: string;
  rewardId: string;
  terminalId?: string | null;
  employeeId?: string | null;
  idempotencyKey: string;
}

interface RefundInput {
  companyId: string;
  transactionId: string;
  terminalId?: string | null;
  employeeId?: string | null;
  idempotencyKey: string;
}

function assertOwnedByCompany(transaction: Transaction, companyId: string): Transaction {
  if (transaction.companyId !== companyId) {
    throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED_ACROSS_COMPANY");
  }
  return transaction;
}

/**
 * Un employeeId n'est jamais pris tel quel dans une requête : il doit référencer un employé
 * réel, actif, et appartenant à cette même entreprise — sinon le journal d'audit pourrait être
 * pollué avec un id arbitraire (ou celui d'une autre entreprise) fourni par le terminal appelant.
 */
async function resolveValidEmployeeId(employeeId: string | null | undefined, companyId: string): Promise<string | null> {
  if (!employeeId) return null;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.companyId !== companyId || !employee.active) {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID");
  }
  return employee.id;
}

/**
 * Enregistre un achat et crédite les points — règle appliquée exclusivement côté serveur
 * (jamais un points_delta envoyé par le client). Atomique : soit le solde et la transaction
 * sont écrits ensemble, soit rien ne l'est. Idempotent : rejouer la même idempotencyKey
 * (double clic, retry réseau) ne crédite jamais deux fois.
 */
export async function recordPurchase(input: RecordPurchaseInput): Promise<Transaction> {
  const existing = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return assertOwnedByCompany(existing, input.companyId);
  }

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company || company.status !== "ACTIVE") {
    throw new HttpError(404, "COMPANY_NOT_FOUND");
  }

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.companyId !== input.companyId) {
    throw new HttpError(404, "CUSTOMER_NOT_FOUND");
  }
  if (customer.status !== "ACTIVE") {
    throw new HttpError(403, "CUSTOMER_BLOCKED");
  }

  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(input.amount);
  } catch {
    throw new HttpError(400, "INVALID_AMOUNT");
  }
  if (amount.lessThanOrEqualTo(0)) {
    throw new HttpError(400, "INVALID_AMOUNT");
  }

  // Règle de fidélité : 1€ dépensé = 1 point par défaut (company.pointsPerCurrencyUnit).
  // Arrondi à l'entier inférieur — jamais de points fractionnaires.
  const pointsDelta = amount.mul(company.pointsPerCurrencyUnit).floor().toNumber();
  const employeeId = await resolveValidEmployeeId(input.employeeId, input.companyId);

  try {
    return await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        // lifetimePoints ne diminue jamais lors d'un échange de récompense (voir schema.prisma) —
        // seul un remboursement (ci-dessous) l'ajuste, puisqu'il annule un gain qui n'aurait
        // jamais dû compter.
        data: { pointsBalance: { increment: pointsDelta }, lifetimePoints: { increment: pointsDelta } },
      });

      const transaction = await tx.transaction.create({
        data: {
          companyId: input.companyId,
          customerId: customer.id,
          employeeId,
          terminalId: input.terminalId ?? null,
          type: "PURCHASE",
          status: "COMPLETED",
          amount,
          pointsDelta,
          balanceAfter: updatedCustomer.pointsBalance,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          actorType: employeeId ? "EMPLOYEE" : "SYSTEM",
          employeeId,
          action: "TRANSACTION_CREATED",
          targetType: "Transaction",
          targetId: transaction.id,
          metadata: { amount: input.amount, pointsDelta, customerId: customer.id, terminalId: input.terminalId ?? null },
        },
      });

      return transaction;
    }).then(async (transaction) => {
      // Anti-fraude : vérifications a posteriori, jamais bloquantes pour l'achat lui-même.
      await Promise.all([
        checkAndAlertRapidTransactions(input.companyId, customer.id).catch(() => {}),
        checkAndAlertUnusualAmount(input.companyId, amount).catch(() => {}),
      ]);
      return transaction;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "idempotencyKey")) {
      // Une requête concurrente a gagné la course sur cette même clé : on renvoie son résultat
      // plutôt que de créditer une seconde fois (l'incrément de cette tentative a été annulé
      // automatiquement par le rollback de la transaction SQL).
      const raced = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return assertOwnedByCompany(raced, input.companyId);
    }
    throw error;
  }
}

/**
 * Échange une récompense du catalogue contre des points (mode POINTS). Ne touche jamais
 * lifetimePoints — seul pointsBalance (le solde dépensable) diminue.
 */
export async function redeemReward(input: RedeemRewardInput): Promise<Transaction> {
  const existing = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return assertOwnedByCompany(existing, input.companyId);
  }

  const [customer, reward] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.reward.findUnique({ where: { id: input.rewardId } }),
  ]);

  if (!customer || customer.companyId !== input.companyId) {
    throw new HttpError(404, "CUSTOMER_NOT_FOUND");
  }
  if (customer.status !== "ACTIVE") {
    throw new HttpError(403, "CUSTOMER_BLOCKED");
  }
  if (!reward || reward.companyId !== input.companyId || !reward.active) {
    throw new HttpError(404, "REWARD_NOT_FOUND");
  }
  if (customer.pointsBalance < reward.pointsCost) {
    throw new HttpError(400, "INSUFFICIENT_POINTS");
  }

  const employeeId = await resolveValidEmployeeId(input.employeeId, input.companyId);
  const pointsDelta = -reward.pointsCost;

  try {
    return await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: { pointsBalance: { increment: pointsDelta } },
      });

      const transaction = await tx.transaction.create({
        data: {
          companyId: input.companyId,
          customerId: customer.id,
          employeeId,
          terminalId: input.terminalId ?? null,
          rewardId: reward.id,
          type: "REDEMPTION",
          status: "COMPLETED",
          amount: new Prisma.Decimal(0),
          pointsDelta,
          balanceAfter: updatedCustomer.pointsBalance,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          actorType: employeeId ? "EMPLOYEE" : "SYSTEM",
          employeeId,
          action: "REWARD_REDEEMED",
          targetType: "Transaction",
          targetId: transaction.id,
          metadata: { rewardId: reward.id, rewardName: reward.name, pointsDelta, customerId: customer.id },
        },
      });

      return transaction;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "idempotencyKey")) {
      const raced = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return assertOwnedByCompany(raced, input.companyId);
    }
    throw error;
  }
}

/**
 * Annule un achat par une transaction de remboursement (jamais une modification directe du solde).
 * L'historique complet est conservé : la transaction d'origine passe à REVERSED, une nouvelle
 * transaction REFUND avec des points négatifs est créée.
 */
export async function refundTransaction(input: RefundInput): Promise<Transaction> {
  const existing = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return assertOwnedByCompany(existing, input.companyId);
  }

  const original = await prisma.transaction.findUnique({ where: { id: input.transactionId } });
  if (!original || original.companyId !== input.companyId) {
    throw new HttpError(404, "TRANSACTION_NOT_FOUND");
  }
  if (original.type !== "PURCHASE") {
    throw new HttpError(400, "NOT_REFUNDABLE");
  }
  if (original.status !== "COMPLETED") {
    throw new HttpError(409, "TRANSACTION_ALREADY_REVERSED");
  }

  const refundPointsDelta = -original.pointsDelta;
  const refundAmount = original.amount.negated();
  const employeeId = await resolveValidEmployeeId(input.employeeId, input.companyId);

  try {
    return await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: original.customerId },
        data: { pointsBalance: { increment: refundPointsDelta }, lifetimePoints: { increment: refundPointsDelta } },
      });

      const refund = await tx.transaction.create({
        data: {
          companyId: input.companyId,
          customerId: original.customerId,
          employeeId,
          terminalId: input.terminalId ?? null,
          type: "REFUND",
          status: "COMPLETED",
          amount: refundAmount,
          pointsDelta: refundPointsDelta,
          balanceAfter: updatedCustomer.pointsBalance,
          idempotencyKey: input.idempotencyKey,
          relatedTransactionId: original.id,
        },
      });

      await tx.transaction.update({
        where: { id: original.id },
        data: { status: "REVERSED" },
      });

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          actorType: employeeId ? "EMPLOYEE" : "SYSTEM",
          employeeId,
          action: "TRANSACTION_REFUNDED",
          targetType: "Transaction",
          targetId: refund.id,
          metadata: { originalTransactionId: original.id, pointsDelta: refundPointsDelta },
        },
      });

      return refund;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "idempotencyKey")) {
      const raced = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return assertOwnedByCompany(raced, input.companyId);
    }
    throw error;
  }
}
