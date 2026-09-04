import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { prisma } from "../prisma";
import { resolveCustomerByToken, getActiveTokenPlaintext } from "../services/tokens";
import { getOrCreateApplePass } from "../services/walletPasses";
import { buildApplePkpass } from "../services/appleWallet/passBuilder";

const router = Router();

/**
 * GET /wallet/apple/pass?token=... — remet le fichier .pkpass au client qui vient de s'inscrire
 * (ou qui veut re-télécharger sa carte). Le token brut, présenté ici par son détenteur légitime,
 * sert lui-même de preuve d'autorisation — aucune autre authentification requise pour ce point
 * d'entrée précis.
 */
router.get(
  "/pass",
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

    const walletPass = await getOrCreateApplePass(customer.id, customer.companyId);

    const buffer = await buildApplePkpass({
      companyName: company.name,
      accentColor: company.accentColor,
      serialNumber: walletPass.serialNumber,
      authenticationToken: walletPass.appleAuthToken!,
      barcodeMessage: token,
      loyaltyNumber: customer.loyaltyNumber,
    });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${company.slug}-loyalty.pkpass"`);
    res.send(buffer);
  }),
);

// ---------------------------------------------------------------------------
// Protocole officiel Apple PassKit Web Service — appelé par iOS lui-même, jamais par notre
// propre frontend. Référence : https://developer.apple.com/documentation/walletpasses
// ---------------------------------------------------------------------------

function extractPassAuthToken(req: Request): string {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("ApplePass ")) {
    throw new HttpError(401, "MISSING_PASS_AUTHORIZATION");
  }
  return header.slice("ApplePass ".length).trim();
}

async function requireAuthorizedPass(passTypeIdentifier: string, serialNumber: string, authToken: string) {
  const walletPass = await prisma.walletPass.findUnique({ where: { serialNumber } });
  if (
    !walletPass ||
    walletPass.passIdentifier !== passTypeIdentifier ||
    walletPass.appleAuthToken !== authToken ||
    walletPass.status !== "ACTIVE"
  ) {
    throw new HttpError(401, "UNAUTHORIZED");
  }
  return walletPass;
}

const registerDeviceSchema = z.object({ pushToken: z.string().min(10).max(300) });

/** Un appareil s'enregistre pour être notifié quand ce pass doit être mis à jour. */
router.post(
  "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber",
  asyncHandler(async (req, res) => {
    const authToken = extractPassAuthToken(req);
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
    const walletPass = await requireAuthorizedPass(passTypeIdentifier, serialNumber, authToken);

    const parsed = registerDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const existing = await prisma.appleDeviceRegistration.findUnique({
      where: {
        deviceLibraryIdentifier_walletPassId: { deviceLibraryIdentifier, walletPassId: walletPass.id },
      },
    });

    if (existing) {
      res.status(200).end();
      return;
    }

    await prisma.appleDeviceRegistration.create({
      data: { deviceLibraryIdentifier, walletPassId: walletPass.id, pushToken: parsed.data.pushToken },
    });

    res.status(201).end();
  }),
);

/** L'appareil se désenregistre (pass supprimé du Wallet). */
router.delete(
  "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber",
  asyncHandler(async (req, res) => {
    const authToken = extractPassAuthToken(req);
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
    const walletPass = await requireAuthorizedPass(passTypeIdentifier, serialNumber, authToken);

    await prisma.appleDeviceRegistration.deleteMany({
      where: { deviceLibraryIdentifier, walletPassId: walletPass.id },
    });

    res.status(200).end();
  }),
);

/** Liste les passes à rafraîchir pour un appareil donné (appelé après un push). */
router.get(
  "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier",
  asyncHandler(async (req, res) => {
    const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
    const updatedSinceRaw = req.query.passesUpdatedSince;
    const updatedSince =
      typeof updatedSinceRaw === "string" && !Number.isNaN(Number(updatedSinceRaw))
        ? new Date(Number(updatedSinceRaw))
        : undefined;

    const registrations = await prisma.appleDeviceRegistration.findMany({
      where: {
        deviceLibraryIdentifier,
        walletPass: {
          passIdentifier: passTypeIdentifier,
          status: "ACTIVE",
          ...(updatedSince ? { updatedAt: { gt: updatedSince } } : {}),
        },
      },
      include: { walletPass: true },
    });

    if (registrations.length === 0) {
      res.status(204).end();
      return;
    }

    res.json({
      serialNumbers: registrations.map((registration) => registration.walletPass.serialNumber),
      lastUpdated: String(Date.now()),
    });
  }),
);

/** Renvoie la version à jour du pass — reconstruit le .pkpass avec le token actif du client. */
router.get(
  "/v1/passes/:passTypeIdentifier/:serialNumber",
  asyncHandler(async (req, res) => {
    const authToken = extractPassAuthToken(req);
    const { passTypeIdentifier, serialNumber } = req.params;
    const walletPass = await requireAuthorizedPass(passTypeIdentifier, serialNumber, authToken);

    const [customer, company] = await Promise.all([
      prisma.customer.findUnique({ where: { id: walletPass.customerId } }),
      prisma.company.findUnique({ where: { id: walletPass.companyId } }),
    ]);
    if (!customer || !company) {
      throw new HttpError(404, "NOT_FOUND");
    }

    const activeToken = await getActiveTokenPlaintext(customer.id);
    if (!activeToken) {
      throw new HttpError(410, "TOKEN_REVOKED");
    }

    const buffer = await buildApplePkpass({
      companyName: company.name,
      accentColor: company.accentColor,
      serialNumber: walletPass.serialNumber,
      authenticationToken: walletPass.appleAuthToken!,
      barcodeMessage: activeToken,
      loyaltyNumber: customer.loyaltyNumber,
    });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Last-Modified", walletPass.updatedAt.toUTCString());
    res.send(buffer);
  }),
);

/** Apple pousse ici les erreurs remontées par les appareils — utile pour le diagnostic. */
router.post(
  "/v1/log",
  asyncHandler(async (req, res) => {
    console.warn("[Apple Wallet device log]", req.body);
    res.status(200).end();
  }),
);

export default router;
