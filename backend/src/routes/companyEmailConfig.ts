import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { deleteEmailConfig, getEmailConfig, isPlatformEmailConfigured, upsertEmailConfig } from "../services/companyEmailConfig";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

/** GET /company/:slug/email-config — ne renvoie JAMAIS la clé, juste ce qui est configuré. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const config = await getEmailConfig(req.employee!.companyId);
    if (!config) {
      res.json({ configured: false, usingPlatformDefault: isPlatformEmailConfigured() });
      return;
    }
    res.json({
      configured: true,
      fromAddress: config.fromAddress,
      hasOwnApiKey: config.smtpPasswordEncrypted !== null,
    });
  }),
);

const emailConfigSchema = z.object({
  fromAddress: z.string().trim().email().max(255),
  // Optionnelle : sans clé propre, l'envoi utilise le compte Resend partagé de la plateforme,
  // avec cette adresse-ci quand même (voir services/companyEmailConfig.ts).
  smtpPassword: z.union([z.string().trim().min(1).max(500), z.literal("")]).optional(),
});

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = emailConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    await upsertEmailConfig(req.employee!.companyId, {
      fromAddress: parsed.data.fromAddress,
      smtpPassword: parsed.data.smtpPassword || undefined,
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "EMAIL_CONFIG_UPDATED",
      metadata: { fromAddress: parsed.data.fromAddress, hasOwnApiKey: Boolean(parsed.data.smtpPassword) },
      ipAddress: req.ip ?? null,
    });

    res.json({ configured: true });
  }),
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await deleteEmailConfig(req.employee!.companyId);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "EMAIL_CONFIG_REMOVED",
      ipAddress: req.ip ?? null,
    });

    res.status(204).end();
  }),
);

export default router;
