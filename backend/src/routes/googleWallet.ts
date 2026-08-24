import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { prisma } from "../prisma";
import { resolveCustomerByToken } from "../services/tokens";
import { getOrCreateGooglePass } from "../services/walletPasses";
import { ensureLoyaltyClass } from "../services/googleWallet/loyaltyClass";
import { ensureLoyaltyObject } from "../services/googleWallet/loyaltyObject";
import { buildSaveToGoogleWalletUrl } from "../services/googleWallet/saveLink";

const router = Router();

/**
 * GET /wallet/google/save-link?token=... — comme pour Apple, le token brut présenté ici,
 * détenu uniquement par son propriétaire légitime, sert lui-même de preuve d'autorisation.
 * Redirige vers l'URL "Ajouter à Google Wallet" (pay.google.com).
 */
router.get(
  "/save-link",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!token) {
      throw new HttpError(400, "TOKEN_REQUIRED");
    }

    const customer = await resolveCustomerByToken(token);
    if (!customer) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    const company = await prisma.company.findUnique({ where: { id: customer.companyId } });
    if (!company) {
      throw new HttpError(404, "COMPANY_NOT_FOUND");
    }

    const classId = await ensureLoyaltyClass({
      slug: company.slug,
      name: company.name,
      logoUrl: company.logoUrl,
    });

    const walletPass = await getOrCreateGooglePass(customer.id, customer.companyId, classId);

    const objectId = await ensureLoyaltyObject({
      classId,
      serialNumber: walletPass.serialNumber,
      barcodeMessage: token,
    });

    const saveUrl = buildSaveToGoogleWalletUrl(objectId);
    res.redirect(302, saveUrl);
  }),
);

export default router;
