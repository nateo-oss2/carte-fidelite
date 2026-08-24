import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireTerminalAuth } from "../middleware/terminalAuth";
import { resolveCustomerByToken, wasTokenRevoked } from "../services/tokens";
import { recordAuditLog } from "../services/auditLog";
import { prisma } from "../prisma";
import { listRewards } from "../services/rewards";
import { listDiscountTiers, resolveApplicableTier } from "../services/discountTiers";
import { alertRevokedTokenAttempt, checkAndAlertRapidScanFailures } from "../services/securityAlerts";

const router = Router();

// Un simple scan ne doit jamais suffire à identifier un client : le terminal doit être authentifié.
router.use(requireTerminalAuth);

// Freine les tentatives de devinette de token (le token lui-même reste la vraie protection,
// mais ça limite le débit d'essais et rend une attaque par force brute impraticable).
const scanLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const resolveSchema = z.object({
  token: z.string().min(10).max(64),
});

/**
 * POST /scan/resolve — étape 1 du scan en boutique : identifie le client à partir du token
 * brut lu dans le code-barres. Ne renvoie que ce dont le staff a besoin pour confirmer l'achat
 * (voir l'écran de scan maquetté en Phase 1) — jamais l'e-mail ou le téléphone complet.
 */
router.post(
  "/resolve",
  scanLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const customer = await resolveCustomerByToken(parsed.data.token);

    // Un token valide mais appartenant à une autre entreprise doit échouer exactement comme
    // un token inconnu — jamais distinguer les deux cas (ça donnerait un oracle d'énumération).
    if (!customer || customer.companyId !== req.terminal!.companyId) {
      await recordAuditLog({
        companyId: req.terminal!.companyId,
        actorType: "SYSTEM",
        action: "SCAN_TOKEN_INVALID",
        metadata: { terminalId: req.terminal!.id },
        ipAddress: req.ip ?? null,
      });
      await checkAndAlertRapidScanFailures(req.terminal!.companyId, req.terminal!.id);
      if (await wasTokenRevoked(parsed.data.token)) {
        await alertRevokedTokenAttempt(req.terminal!.companyId, req.terminal!.id);
      }
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    const company = await prisma.company.findUnique({ where: { id: req.terminal!.companyId } });

    // Prépare déjà ce dont un futur écran de caisse aura besoin pour proposer une récompense
    // ou afficher la réduction en cours, selon le mode choisi par l'entreprise.
    let availableRewards: Array<{ id: string; name: string; pointsCost: number }> = [];
    let currentDiscountPercent: string | null = null;

    if (company!.programType === "POINTS") {
      const rewards = await listRewards(req.terminal!.companyId, true);
      availableRewards = rewards
        .filter((r) => r.pointsCost <= customer.pointsBalance)
        .map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost }));
    } else {
      const tiers = await listDiscountTiers(req.terminal!.companyId);
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
      programType: company!.programType,
      programName: company!.programName,
      companyName: company!.name,
      companyLogoUrl: company!.logoUrl,
      companyAccentColor: company!.accentColor,
      availableRewards,
      currentDiscountPercent,
    });
  }),
);

export default router;
