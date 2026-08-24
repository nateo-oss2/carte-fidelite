import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requirePlatformAdmin } from "../middleware/platformAdminAuth";
import { prisma } from "../prisma";
import { recordAuditLog } from "../services/auditLog";

const router = Router();

router.use(requirePlatformAdmin);

/** GET /admin/security-alerts?resolved=false — non résolues par défaut, plus récentes d'abord. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resolved = req.query.resolved === "true" ? true : req.query.resolved === "all" ? undefined : false;

    const alerts = await prisma.securityAlert.findMany({
      where: resolved === undefined ? undefined : { resolved },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { company: { select: { name: true } } },
    });

    res.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        message: a.message,
        companyName: a.company?.name ?? null,
        resolved: a.resolved,
        createdAt: a.createdAt,
      })),
    });
  }),
);

router.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const alert = await prisma.securityAlert.findUnique({ where: { id: req.params.id } });
    if (!alert) {
      throw new HttpError(404, "ALERT_NOT_FOUND");
    }

    const updated = await prisma.securityAlert.update({
      where: { id: req.params.id },
      data: { resolved: true, resolvedAt: new Date() },
    });

    await recordAuditLog({
      companyId: alert.companyId,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "SECURITY_ALERT_RESOLVED",
      targetType: "SecurityAlert",
      targetId: alert.id,
      ipAddress: req.ip ?? null,
    });

    res.json({ id: updated.id, resolved: updated.resolved });
  }),
);

export default router;
