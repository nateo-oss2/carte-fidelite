import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { joinCompanyProgram } from "../services/customers";
import { generateQrCodePng } from "../services/qrCode";
import { generateBarcodePng } from "../services/barcode";
import { findCustomerByCardViewToken, getActiveTokenPlaintext, resolveCustomerByCardViewToken } from "../services/tokens";
import { listRewards } from "../services/rewards";
import { listDiscountTiers, resolveApplicableTier } from "../services/discountTiers";

const router = Router();

// Endpoint public non authentifié qui écrit en base : limité pour freiner les abus
// (création de masse, énumération de tokens d'entreprise).
const joinLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

async function findActiveCompanyByJoinToken(companyToken: string) {
  const company = await prisma.company.findUnique({ where: { joinToken: companyToken } });
  if (!company || company.status !== "ACTIVE" || company.joinTokenRevokedAt) {
    return null;
  }
  return company;
}

/** GET /join/:companyToken — infos publiques pour afficher la page d'inscription de l'entreprise. */
router.get(
  "/:companyToken",
  asyncHandler(async (req, res) => {
    const company = await findActiveCompanyByJoinToken(req.params.companyToken);
    if (!company) {
      throw new HttpError(404, "PROGRAM_NOT_FOUND");
    }

    res.json({
      companyName: company.name,
      logoUrl: company.logoUrl,
      programName: company.programName,
      accentColor: company.accentColor,
      secondaryColor: company.secondaryColor,
      cardTemplate: company.cardTemplate,
      pointsPerCurrencyUnit: company.pointsPerCurrencyUnit,
    });
  }),
);

/**
 * GET /join/:companyToken/qrcode.png — le QR code d'inscription affichable/imprimable de
 * l'entreprise. Un seul générateur pour toutes les entreprises : seule l'URL encodée change.
 * Contrairement au GET/POST ci-dessus, ne filtre PAS sur le statut actif : afficher l'image
 * du QR code dans un dashboard (admin ou entreprise) doit rester possible même si l'entreprise
 * est suspendue — seule l'inscription réelle via ce lien doit être bloquée dans ce cas.
 */
router.get(
  "/:companyToken/qrcode.png",
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { joinToken: req.params.companyToken } });
    if (!company) {
      throw new HttpError(404, "PROGRAM_NOT_FOUND");
    }

    const joinUrl = `${process.env.FRONTEND_BASE_URL}/join/${company.joinToken}`;
    const png = await generateQrCodePng(joinUrl);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(png);
  }),
);

const joinBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-.\s]{6,20}$/)
    .optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  referralCode: z.string().trim().min(1).max(40).optional(),
});

/** POST /join/:companyToken — inscription d'un client au programme (formulaire après scan du QR). */
router.post(
  "/:companyToken",
  joinLimiter,
  asyncHandler(async (req, res) => {
    const company = await findActiveCompanyByJoinToken(req.params.companyToken);
    if (!company) {
      throw new HttpError(404, "PROGRAM_NOT_FOUND");
    }

    const parsed = joinBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const result = await joinCompanyProgram(company.id, parsed.data, req.ip ?? null);

    res.status(result.alreadyEnrolled ? 200 : 201).json({
      customerId: result.customer.id,
      loyaltyNumber: result.customer.loyaltyNumber,
      pointsBalance: result.customer.pointsBalance,
      alreadyEnrolled: result.alreadyEnrolled,
      referralApplied: result.referralApplied,
      // Valeur à encoder immédiatement dans le pass Wallet généré côté client de cet appel ;
      // elle n'est pas récupérable ensuite (seul son hash est conservé en base).
      walletToken: result.rawToken,
      // Lien "voir ma fiche" — distinct du token du code-barres ci-dessus, lui aussi à usage
      // unique avant sa première rotation (voir GET /join/customer/:token).
      cardViewToken: result.cardViewToken,
    });
  }),
);

/**
 * GET /join/customer/:token — fiche client en lecture seule, accessible au client lui-même
 * (bouton "voir ma fiche" affiché juste après l'inscription). Le lien change une fois, à la
 * première consultation : si `newToken` est présent dans la réponse, c'est le nouveau lien
 * permanent à utiliser désormais — celui qui vient de servir cesse de fonctionner.
 */
router.get(
  "/customer/:token",
  asyncHandler(async (req, res) => {
    const result = await resolveCustomerByCardViewToken(req.params.token);
    if (!result) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }
    const { customer, newToken } = result;

    const company = await prisma.company.findUnique({ where: { id: customer.companyId } });
    if (!company) {
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
      firstName: customer.firstName,
      lastName: customer.lastName,
      loyaltyNumber: customer.loyaltyNumber,
      pointsBalance: customer.pointsBalance,
      lifetimePoints: customer.lifetimePoints,
      companyName: company.name,
      companyLogoUrl: company.logoUrl,
      companyAccentColor: company.accentColor,
      companySecondaryColor: company.secondaryColor,
      companyCardTemplate: company.cardTemplate,
      programType: company.programType,
      availableRewards,
      currentDiscountPercent,
      pointsExpiryEnabled: company.pointsExpiryEnabled,
      pointsExpiryMonths: Math.round(company.pointsExpiryDays / 30),
      offPeakBonus: {
        enabled: company.offPeakBonusEnabled,
        startHour: company.offPeakStartHour,
        endHour: company.offPeakEndHour,
      },
      newToken,
    });
  }),
);

/**
 * GET /join/customer/:token/barcode.png — le code-barres du client, sur sa propre fiche.
 * Ne rejoue jamais la rotation du lien (voir findCustomerByCardViewToken) : seule la
 * consultation de la fiche elle-même (au-dessus) régénère le lien à sa première ouverture.
 */
router.get(
  "/customer/:token/barcode.png",
  asyncHandler(async (req, res) => {
    const customer = await findCustomerByCardViewToken(req.params.token);
    if (!customer) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    const activeToken = await getActiveTokenPlaintext(customer.id);
    if (!activeToken) {
      throw new HttpError(404, "NO_ACTIVE_CARD");
    }

    const png = await generateBarcodePng(activeToken);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(png);
  }),
);

export default router;
