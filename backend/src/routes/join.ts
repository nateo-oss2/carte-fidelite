import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { joinCompanyProgram } from "../services/customers";
import { generateQrCodePng } from "../services/qrCode";
import { resolveCustomerByToken } from "../services/tokens";

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
    });
  }),
);

/**
 * GET /join/customer/:token — fiche client en lecture seule, accessible au client lui-même
 * (bouton "voir ma fiche" affiché juste après l'inscription). Le token est le même identifiant
 * que celui encodé dans le code-barres du pass Wallet — déjà traité comme un secret porteur.
 */
router.get(
  "/customer/:token",
  asyncHandler(async (req, res) => {
    const customer = await resolveCustomerByToken(req.params.token);
    if (!customer) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    const company = await prisma.company.findUnique({ where: { id: customer.companyId } });
    if (!company) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
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
      programType: company.programType,
    });
  }),
);

export default router;
