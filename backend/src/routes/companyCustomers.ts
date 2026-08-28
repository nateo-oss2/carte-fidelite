import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { findTodaysBirthdays, getCustomerDetail, listCustomers } from "../services/customers";
import { getActiveTokenPlaintext, revokeActiveToken } from "../services/tokens";
import { sendNotifications } from "../services/customerNotifications";
import { generateBarcodePng } from "../services/barcode";
import { prisma } from "../prisma";
import { recordAuditLog } from "../services/auditLog";
import { redeemReward } from "../services/transactions";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth);

/** GET /company/:slug/customers?search=... — consultable par tout employé authentifié. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
    const customers = await listCustomers(req.employee!.companyId, search || undefined);
    res.json({ customers });
  }),
);

/** GET /company/:slug/customers/birthdays-today — clients dont c'est l'anniversaire aujourd'hui. */
router.get(
  "/birthdays-today",
  asyncHandler(async (req, res) => {
    const customers = await findTodaysBirthdays(req.employee!.companyId);
    res.json({ customers });
  }),
);

/** GET /company/:slug/customers/:customerId — fiche détaillée (solde, statut, historique récent). */
router.get(
  "/:customerId",
  asyncHandler(async (req, res) => {
    const customer = await getCustomerDetail(req.employee!.companyId, req.params.customerId);
    if (!customer) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }
    res.json(customer);
  }),
);

/**
 * GET /company/:slug/customers/:customerId/barcode.png — le vrai code-barres scannable du
 * client. Réservé ADMIN/MANAGER : c'est l'équivalent visuel de sa carte, jamais montré à la
 * légère (un simple EMPLOYEE n'en a pas besoin pour encaisser — le scanner s'en charge).
 */
router.get(
  "/:customerId/barcode.png",
  requireEmployeeRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.customerId } });
    if (!customer || customer.companyId !== req.employee!.companyId) {
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

/**
 * POST /company/:slug/customers/:customerId/revoke-token — révoque la carte d'un client
 * (perte/vol signalé). Réservé aux ADMIN/MANAGER — jamais un simple EMPLOYEE (section 18).
 */
router.post(
  "/:customerId/revoke-token",
  requireEmployeeRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.customerId } });
    if (!customer || customer.companyId !== req.employee!.companyId) {
      throw new HttpError(404, "CUSTOMER_NOT_FOUND");
    }

    await revokeActiveToken(customer.id);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "CUSTOMER_CARD_REVOKED",
      targetType: "Customer",
      targetId: customer.id,
      ipAddress: req.ip ?? null,
    });

    res.status(200).json({ revoked: true });
  }),
);

const redeemSchema = z.object({ rewardId: z.string().uuid() });

/**
 * POST /company/:slug/customers/:customerId/redeem — échange une récompense depuis la fiche
 * client (équivalent de l'échange proposé sur l'écran de scan, mais depuis l'onglet Clients).
 */
router.post(
  "/:customerId/redeem",
  asyncHandler(async (req, res) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await redeemReward({
      companyId: req.employee!.companyId,
      customerId: req.params.customerId,
      rewardId: parsed.data.rewardId,
      employeeId: req.employee!.id,
      idempotencyKey: `redeem-${req.params.customerId}-${parsed.data.rewardId}-${Date.now()}`,
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: transaction.status,
      pointsDelta: transaction.pointsDelta,
      balanceAfter: transaction.balanceAfter,
    });
  }),
);

const notifyLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20, // 20 envois groupés par heure et par entreprise-terminal : freine un usage abusif
  standardHeaders: true,
  legacyHeaders: false,
});

const notifySchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(100),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
});

/**
 * POST /company/:slug/customers/notify — envoie un e-mail (relance, promotion...) à un ou
 * plusieurs clients sélectionnés. Ouvert à tout employé authentifié (pas de restriction de
 * rôle ici, contrairement à la révocation de carte) : c'est un usage courant de vente/relance.
 */
router.post(
  "/notify",
  notifyLimiter,
  asyncHandler(async (req, res) => {
    const parsed = notifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const outcome = await sendNotifications(
      req.employee!.companyId,
      req.employee!.id,
      parsed.data.customerIds,
      parsed.data.subject,
      parsed.data.message,
    );

    if (!outcome.configured) {
      throw new HttpError(
        503,
        "EMAIL_NOT_CONFIGURED",
        "Aucun fournisseur e-mail n'est configuré pour cette entreprise. Configurez-le dans Programme > E-mail.",
      );
    }

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "CUSTOMER_NOTIFICATION_SENT",
      metadata: JSON.parse(
        JSON.stringify({ customerIds: parsed.data.customerIds, subject: parsed.data.subject, results: outcome.results }),
      ),
      ipAddress: req.ip ?? null,
    });

    res.json({ results: outcome.results });
  }),
);

export default router;
