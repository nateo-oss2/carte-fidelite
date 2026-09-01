import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { deleteEmailConfig, getEmailConfig, isPlatformEmailConfigured, upsertEmailConfig } from "../services/companyEmailConfig";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

/** GET /company/:slug/email-config — ne renvoie JAMAIS le mot de passe, juste s'il est configuré. */
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
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      fromAddress: config.fromAddress,
    });
  }),
);

const emailConfigSchema = z.object({
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().min(1).max(255),
  smtpPassword: z.string().min(1).max(500),
  fromAddress: z.string().trim().email().max(255),
});

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = emailConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    await upsertEmailConfig(req.employee!.companyId, parsed.data);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "EMAIL_CONFIG_UPDATED",
      metadata: { smtpHost: parsed.data.smtpHost, fromAddress: parsed.data.fromAddress },
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
