import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { resolveCustomerByToken, wasTokenRevoked } from "../services/tokens";
import { recordAuditLog } from "../services/auditLog";
import { prisma } from "../prisma";
import { listRewards } from "../services/rewards";
import { listDiscountTiers, resolveApplicableTier } from "../services/discountTiers";
import { alertRevokedTokenAttempt, checkAndAlertRapidScanFailures } from "../services/securityAlerts";
import { recordPurchase, redeemReward } from "../services/transactions";

/**
 * Écran de scan en caisse — page web autonome, séparée du dashboard de gestion.
 * Pas de compte employé ni de mot de passe : la confidentialité du lien lui-même
 * (scanToken, jamais rendu public contrairement à joinToken) fait office de protection.
 * Régénérable à tout moment depuis le dashboard si le lien a fuité.
 */
const router = Router({ mergeParams: true });

const scanLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

async function requireCompanyByScanToken(scanToken: string) {
  const company = await prisma.company.findUnique({ where: { scanToken } });
  if (!company || company.status !== "ACTIVE") {
    throw new HttpError(404, "SCAN_LINK_INVALID");
  }
  return company;
}

/** GET /scan-console/:scanToken — infos publiques d'affichage (nom/logo de l'entreprise). */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const company = await requireCompanyByScanToken(req.params.scanToken);
    res.json({ companyName: company.name, companyLogoUrl: company.logoUrl, companyAccentColor: company.accentColor });
  }),
);

const resolveSchema = z.object({
  token: z.string().min(10).max(64),
});

router.post(
  "/resolve",
  scanLimiter,
  asyncHandler(async (req, res) => {
    const company = await requireCompanyByScanToken(req.params.scanToken);

    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const customer = await resolveCustomerByToken(parsed.data.token);

    if (!customer || customer.companyId !== company.id) {
      await recordAuditLog({
        companyId: company.id,
        actorType: "SYSTEM",
        action: "SCAN_TOKEN_INVALID",
        ipAddress: req.ip ?? null,
      });
      await checkAndAlertRapidScanFailures(company.id, req.ip ?? "unknown");
      if (await wasTokenRevoked(parsed.data.token)) {
        await alertRevokedTokenAttempt(company.id, req.ip ?? "unknown");
      }
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    let availableRewards: Array<{ id: string; name: string; pointsCost: number }> = [];
    let currentDiscountPercent: string | null = null;

    if (company.programType === "POINTS") {
      const rewards = await listRewards(company.id, true);
      availableRewards = rewards
        .filter((r) => r.pointsCost <= customer.pointsBalance)
        .map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost }));
    } else {
      const tiers = await listDiscountTiers(company.id);
      const tier = resolveApplicableTier(tiers, customer.lifetimePoints);
      currentDiscountPercent = tier ? tier.discountPercent.toString() : null;
    }

    res.json({
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      loyaltyNumber: customer.loyaltyNumber,
      pointsBalance: customer.pointsBalance,
      lifetimePoints: customer.lifetimePoints,
      createdAt: customer.createdAt,
      programType: company.programType,
      programName: company.programName,
      companyName: company.name,
      companyLogoUrl: company.logoUrl,
      companyAccentColor: company.accentColor,
      availableRewards,
      currentDiscountPercent,
    });
  }),
);

const purchaseSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  idempotencyKey: z.string().min(8).max(100),
});

router.post(
  "/transactions",
  asyncHandler(async (req, res) => {
    const company = await requireCompanyByScanToken(req.params.scanToken);

    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await recordPurchase({
      companyId: company.id,
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: transaction.status,
      pointsDelta: transaction.pointsDelta,
      balanceAfter: transaction.balanceAfter,
    });
  }),
);

const redeemSchema = z.object({
  customerId: z.string().uuid(),
  rewardId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100),
});

router.post(
  "/transactions/redeem",
  asyncHandler(async (req, res) => {
    const company = await requireCompanyByScanToken(req.params.scanToken);

    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await redeemReward({
      companyId: company.id,
      customerId: parsed.data.customerId,
      rewardId: parsed.data.rewardId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: transaction.status,
      pointsDelta: transaction.pointsDelta,
      balanceAfter: transaction.balanceAfter,
    });
  }),
);

export default router;
