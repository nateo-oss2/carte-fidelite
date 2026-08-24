import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePlatformAdmin } from "../middleware/platformAdminAuth";
import { prisma } from "../prisma";

const router = Router();

router.use(requirePlatformAdmin);

/** GET /admin/audit-logs?companyId=...&take=50 — lecture seule, jamais modifiable. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
    const take = Math.min(Number(req.query.take) || 50, 200);

    const logs = await prisma.auditLog.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        company: { select: { name: true } },
        employee: { select: { name: true } },
        platformAdmin: { select: { email: true } },
      },
    });

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorType: log.actorType,
        actorLabel: log.employee?.name ?? log.platformAdmin?.email ?? null,
        companyName: log.company?.name ?? null,
        targetType: log.targetType,
        targetId: log.targetId,
        createdAt: log.createdAt,
      })),
    });
  }),
);

export default router;
