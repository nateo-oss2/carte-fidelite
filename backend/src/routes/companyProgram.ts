import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { prisma } from "../prisma";
import { createReward, deleteReward, listRewards, updateReward } from "../services/rewards";
import { createDiscountTier, deleteDiscountTier, listDiscountTiers, updateDiscountTier } from "../services/discountTiers";
import { recordAuditLog } from "../services/auditLog";
import { runInactivityRemindersForCompany } from "../services/inactivityReminders";
import { runPointsExpiryForCompany } from "../services/pointsExpiry";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth);

/** GET /company/:slug/program — mode actuel + catalogue de récompenses ou paliers, selon le mode. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.employee!.companyId } });
    const [rewards, discountTiers] = await Promise.all([
      listRewards(req.employee!.companyId),
      listDiscountTiers(req.employee!.companyId),
    ]);
    res.json({
      programType: company!.programType,
      rewards,
      discountTiers,
      inactivityReminder: {
        enabled: company!.inactivityReminderEnabled,
        thresholdDays: company!.inactivityThresholdDays,
        subject: company!.inactivityReminderSubject,
        message: company!.inactivityReminderMessage,
      },
      referralBonusPoints: company!.referralBonusPoints,
      offPeakBonus: {
        enabled: company!.offPeakBonusEnabled,
        startHour: company!.offPeakStartHour,
        endHour: company!.offPeakEndHour,
      },
      pointsExpiry: {
        enabled: company!.pointsExpiryEnabled,
        days: company!.pointsExpiryDays,
      },
    });
  }),
);

const updateProgramSchema = z.object({ programType: z.enum(["POINTS", "DISCOUNT"]) });

/** PATCH /company/:slug/program — bascule entre mode POINTS et mode DISCOUNT. Réservé ADMIN. */
router.patch(
  "/",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = updateProgramSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: { programType: parsed.data.programType },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "PROGRAM_TYPE_UPDATED",
      metadata: { programType: parsed.data.programType },
      ipAddress: req.ip ?? null,
    });

    res.json({ programType: company.programType });
  }),
);

// --- Récompenses (mode POINTS) ---

const rewardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  pointsCost: z.number().int().positive(),
});

router.post(
  "/rewards",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = rewardSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");
    const reward = await createReward(req.employee!.companyId, parsed.data.name, parsed.data.pointsCost);
    res.status(201).json(reward);
  }),
);

const updateRewardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  pointsCost: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

router.patch(
  "/rewards/:rewardId",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = updateRewardSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");
    const reward = await updateReward(req.employee!.companyId, req.params.rewardId, parsed.data);
    res.json(reward);
  }),
);

router.delete(
  "/rewards/:rewardId",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await deleteReward(req.employee!.companyId, req.params.rewardId);
    res.status(204).end();
  }),
);

// --- Paliers de réduction (mode DISCOUNT) ---

const tierSchema = z.object({
  label: z.string().trim().min(1).max(60),
  thresholdPoints: z.number().int().nonnegative(),
  discountPercent: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/),
});

router.post(
  "/discount-tiers",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = tierSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");
    const tier = await createDiscountTier(
      req.employee!.companyId,
      parsed.data.label,
      parsed.data.thresholdPoints,
      parsed.data.discountPercent,
    );
    res.status(201).json(tier);
  }),
);

const updateTierSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  thresholdPoints: z.number().int().nonnegative().optional(),
  discountPercent: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/)
    .optional(),
});

router.patch(
  "/discount-tiers/:tierId",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = updateTierSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");
    const tier = await updateDiscountTier(req.employee!.companyId, req.params.tierId, parsed.data);
    res.json(tier);
  }),
);

router.delete(
  "/discount-tiers/:tierId",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await deleteDiscountTier(req.employee!.companyId, req.params.tierId);
    res.status(204).end();
  }),
);

// --- Relance automatique par inactivité ---

const inactivityReminderSchema = z.object({
  enabled: z.boolean(),
  thresholdDays: z.number().int().min(1).max(365),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
});

router.patch(
  "/inactivity-reminder",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = inactivityReminderSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");

    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: {
        inactivityReminderEnabled: parsed.data.enabled,
        inactivityThresholdDays: parsed.data.thresholdDays,
        inactivityReminderSubject: parsed.data.subject,
        inactivityReminderMessage: parsed.data.message,
      },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "INACTIVITY_REMINDER_UPDATED",
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({
      enabled: company.inactivityReminderEnabled,
      thresholdDays: company.inactivityThresholdDays,
      subject: company.inactivityReminderSubject,
      message: company.inactivityReminderMessage,
    });
  }),
);

/** POST /company/:slug/program/inactivity-reminder/run-now — déclenchement manuel, pour tester. */
router.post(
  "/inactivity-reminder/run-now",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await runInactivityRemindersForCompany(req.employee!.companyId);
    if (!result) {
      throw new HttpError(
        409,
        "REMINDER_NOT_READY",
        "Activez la relance automatique et configurez un fournisseur e-mail avant de tester.",
      );
    }
    res.json(result);
  }),
);

// --- Parrainage ---

const referralSchema = z.object({ bonusPoints: z.number().int().min(0).max(1000) });

/** PATCH /company/:slug/program/referral — montant de points offert au parrain ET au filleul. */
router.patch(
  "/referral",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = referralSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");

    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: { referralBonusPoints: parsed.data.bonusPoints },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "REFERRAL_BONUS_UPDATED",
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({ bonusPoints: company.referralBonusPoints });
  }),
);

// --- Heures creuses (points doublés) ---

const offPeakSchema = z
  .object({
    enabled: z.boolean(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  })
  .refine((v) => v.startHour !== v.endHour, { message: "startHour et endHour doivent différer" });

router.patch(
  "/off-peak",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = offPeakSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");

    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: {
        offPeakBonusEnabled: parsed.data.enabled,
        offPeakStartHour: parsed.data.startHour,
        offPeakEndHour: parsed.data.endHour,
      },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "OFF_PEAK_BONUS_UPDATED",
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({
      enabled: company.offPeakBonusEnabled,
      startHour: company.offPeakStartHour,
      endHour: company.offPeakEndHour,
    });
  }),
);

// --- Expiration des points ---

const pointsExpirySchema = z.object({ enabled: z.boolean(), days: z.number().int().min(30).max(1825) });

router.patch(
  "/points-expiry",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = pointsExpirySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "INVALID_INPUT");

    const company = await prisma.company.update({
      where: { id: req.employee!.companyId },
      data: { pointsExpiryEnabled: parsed.data.enabled, pointsExpiryDays: parsed.data.days },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "POINTS_EXPIRY_UPDATED",
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({ enabled: company.pointsExpiryEnabled, days: company.pointsExpiryDays });
  }),
);

/** POST /company/:slug/program/points-expiry/run-now — déclenchement manuel, pour tester. */
router.post(
  "/points-expiry/run-now",
  requireEmployeeRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await runPointsExpiryForCompany(req.employee!.companyId);
    if (!result) {
      throw new HttpError(409, "EXPIRY_NOT_READY", "Activez l'expiration des points avant de tester.");
    }
    res.json(result);
  }),
);

export default router;
