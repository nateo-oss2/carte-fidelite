import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { getCompanyDashboardStats } from "../services/companyStats";
import { recordAuditLog } from "../services/auditLog";
import { prisma } from "../prisma";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.employee!.companyId } });
    const stats = await getCompanyDashboardStats(req.employee!.companyId);

    res.json({
      company: {
        name: company!.name,
        accentColor: company!.accentColor,
        logoUrl: company!.logoUrl,
        joinToken: company!.joinToken,
        scanToken: company!.scanToken,
        pointsPerCurrencyUnit: company!.pointsPerCurrencyUnit,
      },
      stats,
    });
  }),
);

/**
 * POST /company/:slug/dashboard/regenerate-scan-token — invalide le lien de scan actuel et
 * en génère un nouveau. À utiliser si le lien a fuité (ex: transmis par erreur, appareil perdu).
 */
router.post(
  "/regenerate-scan-token",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: { scanToken: `st_${crypto.randomUUID().replace(/-/g, "")}` },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "SCAN_TOKEN_REGENERATED",
      ipAddress: req.ip ?? null,
    });

    res.json({ scanToken: company.scanToken });
  }),
);

export default router;
