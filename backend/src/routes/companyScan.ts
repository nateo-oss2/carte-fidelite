import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth } from "../middleware/companyAuth";
import { resolveCustomerByToken, wasTokenRevoked } from "../services/tokens";
import { recordAuditLog } from "../services/auditLog";
import { prisma } from "../prisma";
import { listRewards } from "../services/rewards";
import { listDiscountTiers, resolveApplicableTier } from "../services/discountTiers";
import { alertRevokedTokenAttempt, checkAndAlertRapidScanFailures } from "../services/securityAlerts";
import { recordPurchase, redeemReward } from "../services/transactions";
import { isOffPeakNow } from "../lib/offPeak";

/**
 * Scan et encaissement depuis le dashboard entreprise — authentifié par la session employé
 * (pas de clé de terminal séparée : un employé connecté sur un poste peut scanner directement).
 */
const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth);

const scanLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const resolveSchema = z.object({
  token: z.string().min(10).max(64),
});

/** POST /company/:slug/scan/resolve — identifie un client à partir du token scanné. */
router.post(
  "/resolve",
  scanLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const customer = await resolveCustomerByToken(parsed.data.token);

    if (!customer || customer.companyId !== req.employee!.companyId) {
      await recordAuditLog({
        companyId: req.employee!.companyId,
        actorType: "EMPLOYEE",
        employeeId: req.employee!.id,
        action: "SCAN_TOKEN_INVALID",
        ipAddress: req.ip ?? null,
      });
      await checkAndAlertRapidScanFailures(req.employee!.companyId, req.employee!.id);
      if (await wasTokenRevoked(parsed.data.token)) {
        await alertRevokedTokenAttempt(req.employee!.companyId, req.employee!.id);
      }
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    const company = await prisma.company.findUnique({ where: { id: req.employee!.companyId } });

    let availableRewards: Array<{ id: string; name: string; pointsCost: number }> = [];
    let currentDiscountPercent: string | null = null;

    if (company!.programType === "POINTS") {
      const rewards = await listRewards(req.employee!.companyId, true);
      availableRewards = rewards
        .filter((r) => r.pointsCost <= customer.pointsBalance)
        .map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost }));
    } else {
      const tiers = await listDiscountTiers(req.employee!.companyId);
      const tier = resolveApplicableTier(tiers, customer.lifetimePoints);
      currentDiscountPercent = tier ? tier.discountPercent.toString() : null;
    }

    res.json({
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      loyaltyNumber: customer.loyaltyNumber,
      pointsBalance: customer.pointsBalance,
      lifetimePoints: customer.lifetimePoints,
      createdAt: customer.createdAt,
      programType: company!.programType,
      programName: company!.programName,
      companyName: company!.name,
      companyLogoUrl: company!.logoUrl,
      companyAccentColor: company!.accentColor,
      availableRewards,
      currentDiscountPercent,
      offPeakActive: isOffPeakNow(company!),
    });
  }),
);

const purchaseSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  idempotencyKey: z.string().min(8).max(100),
});

/** POST /company/:slug/scan/transactions — enregistre un achat pour le client scanné. */
router.post(
  "/transactions",
  asyncHandler(async (req, res) => {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await recordPurchase({
      companyId: req.employee!.companyId,
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      employeeId: req.employee!.id,
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

/** POST /company/:slug/scan/transactions/redeem — échange une récompense pour le client scanné. */
router.post(
  "/transactions/redeem",
  asyncHandler(async (req, res) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await redeemReward({
      companyId: req.employee!.companyId,
      customerId: parsed.data.customerId,
      rewardId: parsed.data.rewardId,
      employeeId: req.employee!.id,
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
