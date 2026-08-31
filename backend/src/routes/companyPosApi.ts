import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { deletePosApiCredential, getPosApiCredentialStatus, upsertPosApiCredential } from "../services/posApiCredential";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

/** GET /company/:slug/pos-api — ne renvoie JAMAIS la clé, juste ce qui est configuré. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const config = await getPosApiCredentialStatus(req.employee!.companyId);
    if (!config) {
      res.json({ configured: false });
      return;
    }
    res.json({
      configured: true,
      providerName: config.providerName,
      apiBaseUrl: config.apiBaseUrl,
      connectedAt: config.connectedAt,
      updatedAt: config.updatedAt,
    });
  }),
);

const posApiSchema = z.object({
  providerName: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(1).max(2000),
  apiBaseUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
});

/** PUT /company/:slug/pos-api — enregistre (ou remplace) les identifiants d'un logiciel de caisse. */
router.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = posApiSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    await upsertPosApiCredential(req.employee!.companyId, {
      providerName: parsed.data.providerName,
      apiKey: parsed.data.apiKey,
      apiBaseUrl: parsed.data.apiBaseUrl || undefined,
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "POS_API_CREDENTIAL_UPDATED",
      metadata: { providerName: parsed.data.providerName },
      ipAddress: req.ip ?? null,
    });

    res.json({ configured: true });
  }),
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await deletePosApiCredential(req.employee!.companyId);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "POS_API_CREDENTIAL_REMOVED",
      ipAddress: req.ip ?? null,
    });

    res.status(204).end();
  }),
);

export default router;
