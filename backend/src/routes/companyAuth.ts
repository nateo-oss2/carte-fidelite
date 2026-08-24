import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { SESSION_COOKIE_NAME, signEmployeeSessionToken } from "../services/companyAuth";
import { requireEmployeeAuth } from "../middleware/companyAuth";
import { recordAuditLog } from "../services/auditLog";
import { checkAndAlertLoginFailures } from "../services/securityAlerts";
import { createPasswordResetToken, consumePasswordResetToken } from "../services/passwordReset";
import { sendSystemEmail } from "../services/systemEmail";

const router = Router({ mergeParams: true });

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

const isProduction = process.env.NODE_ENV === "production";

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await prisma.company.findUnique({ where: { slug: req.params.slug } });
    if (!company || company.status !== "ACTIVE") {
      throw new HttpError(404, "COMPANY_NOT_FOUND");
    }

    const employee = await prisma.employee.findUnique({
      where: { companyId_email: { companyId: company.id, email: parsed.data.email } },
    });

    const passwordOk = await verifyPassword(
      parsed.data.password,
      employee?.passwordHash ?? "$2a$12$invalidsaltinvalidsaltinvalidsalthash000000000000000",
    );

    if (!employee || !employee.active || !passwordOk) {
      await recordAuditLog({
        companyId: company.id,
        actorType: "SYSTEM",
        action: "EMPLOYEE_LOGIN_FAILED",
        metadata: { email: parsed.data.email },
        ipAddress: req.ip ?? null,
      });
      await checkAndAlertLoginFailures("EMPLOYEE", parsed.data.email, company.id);
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }

    const token = signEmployeeSessionToken(employee.id);
    setSessionCookie(res, token);

    await recordAuditLog({
      companyId: company.id,
      actorType: "EMPLOYEE",
      employeeId: employee.id,
      action: "EMPLOYEE_LOGIN_SUCCESS",
      ipAddress: req.ip ?? null,
    });

    res.json({ name: employee.name, role: employee.role });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(200).end();
});

router.get(
  "/me",
  requireEmployeeAuth,
  asyncHandler(async (req, res) => {
    res.json({ id: req.employee!.id, name: req.employee!.name, role: req.employee!.role });
  }),
);

// --- Récupération de compte ---

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await prisma.company.findUnique({ where: { slug: req.params.slug } });
    if (company && company.status === "ACTIVE") {
      const employee = await prisma.employee.findUnique({
        where: { companyId_email: { companyId: company.id, email: parsed.data.email } },
      });

      // Toujours la même réponse, que le compte existe ou non.
      if (employee?.active) {
        const rawToken = await createPasswordResetToken("EMPLOYEE", employee.id);
        const resetUrl = `${process.env.FRONTEND_BASE_URL}/company/${company.slug}/reset-password?token=${rawToken}`;
        try {
          await sendSystemEmail({
            to: employee.email,
            subject: "Réinitialisation de votre mot de passe",
            text: `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1 heure) :\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
          });
        } catch {
          // Best-effort : ne fait jamais échouer la réponse côté client.
        }
        await recordAuditLog({
          companyId: company.id,
          actorType: "EMPLOYEE",
          employeeId: employee.id,
          action: "EMPLOYEE_PASSWORD_RESET_REQUESTED",
          ipAddress: req.ip ?? null,
        });
      }
    }

    res.json({ ok: true });
  }),
);

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(10).max(200),
});

router.post(
  "/reset-password",
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await prisma.company.findUnique({ where: { slug: req.params.slug } });
    const employeeId = await consumePasswordResetToken("EMPLOYEE", parsed.data.token);
    if (!employeeId || !company) {
      throw new HttpError(400, "INVALID_OR_EXPIRED_TOKEN");
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.companyId !== company.id) {
      throw new HttpError(400, "INVALID_OR_EXPIRED_TOKEN");
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.employee.update({ where: { id: employeeId }, data: { passwordHash } });

    await recordAuditLog({
      companyId: employee.companyId,
      actorType: "EMPLOYEE",
      employeeId,
      action: "EMPLOYEE_PASSWORD_RESET_COMPLETED",
      ipAddress: req.ip ?? null,
    });

    res.json({ ok: true });
  }),
);

export default router;
