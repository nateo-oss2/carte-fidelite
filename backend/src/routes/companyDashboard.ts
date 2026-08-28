import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireEmployeeAuth } from "../middleware/companyAuth";
import { getCompanyDashboardStats } from "../services/companyStats";
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
        secondaryColor: company!.secondaryColor,
        cardTemplate: company!.cardTemplate,
        logoUrl: company!.logoUrl,
        joinToken: company!.joinToken,
        pointsPerCurrencyUnit: company!.pointsPerCurrencyUnit,
      },
      stats,
    });
  }),
);

export default router;
