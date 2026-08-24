import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requirePlatformAdmin } from "../middleware/platformAdminAuth";
import { listBackups, runDatabaseBackup } from "../services/backup";
import { recordAuditLog } from "../services/auditLog";

const router = Router();

router.use(requirePlatformAdmin);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const backups = await listBackups();
    res.json({ backups });
  }),
);

router.post(
  "/run-now",
  asyncHandler(async (req, res) => {
    try {
      const result = await runDatabaseBackup();
      await recordAuditLog({
        actorType: "PLATFORM_ADMIN",
        platformAdminId: req.platformAdmin!.id,
        action: "DATABASE_BACKUP_CREATED",
        metadata: result,
        ipAddress: req.ip ?? null,
      });
      res.json(result);
    } catch (error) {
      throw new HttpError(500, "BACKUP_FAILED", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    }
  }),
);

export default router;
