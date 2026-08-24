import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "../lib/passwords";
import {
  MFA_PENDING_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  signAdminSessionToken,
  signMfaPendingToken,
  verifyMfaPendingToken,
} from "../services/platformAdminAuth";
import { requirePlatformAdmin } from "../middleware/platformAdminAuth";
import { recordAuditLog } from "../services/auditLog";
import { generateMfaSecret, generateMfaSetupQrCode, verifyMfaCode } from "../services/mfa";
import { createPasswordResetToken, consumePasswordResetToken } from "../services/passwordReset";
import { sendSystemEmail } from "../services/systemEmail";
import { checkAndAlertLoginFailures } from "../services/securityAlerts";

const router = Router();

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
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function setMfaPendingCookie(res: Response, token: string) {
  res.cookie(MFA_PENDING_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
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

    const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });

    // Toujours exécuter une comparaison (même sur un hash factice) pour ne pas laisser
    // le temps de réponse révéler si l'e-mail existe.
    const passwordOk = await verifyPassword(
      parsed.data.password,
      admin?.passwordHash ?? "$2a$12$invalidsaltinvalidsaltinvalidsalthash000000000000000",
    );

    if (!admin || !admin.active || !passwordOk) {
      await recordAuditLog({
        actorType: "SYSTEM",
        action: "ADMIN_LOGIN_FAILED",
        metadata: { email: parsed.data.email },
        ipAddress: req.ip ?? null,
      });
      await checkAndAlertLoginFailures("ADMIN", parsed.data.email);
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }

    if (admin.mfaEnabled) {
      const pendingToken = signMfaPendingToken(admin.id);
      setMfaPendingCookie(res, pendingToken);
      res.json({ mfaRequired: true });
      return;
    }

    const token = signAdminSessionToken(admin.id);
    setSessionCookie(res, token);

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: admin.id,
      action: "ADMIN_LOGIN_SUCCESS",
      ipAddress: req.ip ?? null,
    });

    res.json({ email: admin.email, mfaRequired: false });
  }),
);

const mfaChallengeSchema = z.object({ code: z.string().trim().min(6).max(6) });

/** POST /admin/auth/mfa/challenge — étape 2 du login quand le MFA est activé. */
router.post(
  "/mfa/challenge",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const pendingToken = req.cookies?.[MFA_PENDING_COOKIE_NAME];
    const adminId = typeof pendingToken === "string" ? verifyMfaPendingToken(pendingToken) : null;
    if (!adminId) {
      throw new HttpError(401, "MFA_CHALLENGE_EXPIRED");
    }

    const parsed = mfaChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active || !admin.mfaEnabled || !admin.mfaSecret) {
      throw new HttpError(401, "MFA_CHALLENGE_EXPIRED");
    }

    if (!(await verifyMfaCode(admin.mfaSecret, parsed.data.code))) {
      await recordAuditLog({
        actorType: "PLATFORM_ADMIN",
        platformAdminId: admin.id,
        action: "ADMIN_MFA_CHALLENGE_FAILED",
        ipAddress: req.ip ?? null,
      });
      throw new HttpError(401, "INVALID_MFA_CODE");
    }

    res.clearCookie(MFA_PENDING_COOKIE_NAME);
    const token = signAdminSessionToken(admin.id);
    setSessionCookie(res, token);

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: admin.id,
      action: "ADMIN_LOGIN_SUCCESS",
      ipAddress: req.ip ?? null,
    });

    res.json({ email: admin.email });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(200).end();
});

router.get(
  "/me",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdmin!.id } });
    res.json({ email: req.platformAdmin!.email, mfaEnabled: admin!.mfaEnabled });
  }),
);

// --- MFA : activation / désactivation (nécessite d'être déjà connecté) ---

router.post(
  "/mfa/setup",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const secret = generateMfaSecret();
    await prisma.platformAdmin.update({ where: { id: req.platformAdmin!.id }, data: { mfaSecret: secret } });
    const qrCodeDataUrl = await generateMfaSetupQrCode(secret, req.platformAdmin!.email);
    res.json({ qrCodeDataUrl, secret });
  }),
);

const mfaVerifySchema = z.object({ code: z.string().trim().min(6).max(6) });

router.post(
  "/mfa/verify-setup",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const parsed = mfaVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdmin!.id } });
    if (!admin?.mfaSecret) {
      throw new HttpError(400, "MFA_SETUP_NOT_STARTED");
    }
    if (!(await verifyMfaCode(admin.mfaSecret, parsed.data.code))) {
      throw new HttpError(401, "INVALID_MFA_CODE");
    }

    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { mfaEnabled: true } });

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: admin.id,
      action: "ADMIN_MFA_ENABLED",
      ipAddress: req.ip ?? null,
    });

    res.json({ mfaEnabled: true });
  }),
);

router.post(
  "/mfa/disable",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const parsed = mfaVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdmin!.id } });
    if (!admin?.mfaEnabled || !admin.mfaSecret || !(await verifyMfaCode(admin.mfaSecret, parsed.data.code))) {
      throw new HttpError(401, "INVALID_MFA_CODE");
    }

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: admin.id,
      action: "ADMIN_MFA_DISABLED",
      ipAddress: req.ip ?? null,
    });

    res.json({ mfaEnabled: false });
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

    const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });

    // Toujours la même réponse, que le compte existe ou non — ne jamais révéler quels
    // e-mails sont enregistrés.
    if (admin?.active) {
      const rawToken = await createPasswordResetToken("PLATFORM_ADMIN", admin.id);
      const resetUrl = `${process.env.FRONTEND_BASE_URL}/admin/reset-password?token=${rawToken}`;
      try {
        await sendSystemEmail({
          to: admin.email,
          subject: "Réinitialisation de votre mot de passe",
          text: `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1 heure) :\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
        });
      } catch {
        // Ne jamais faire échouer la réponse côté client à cause d'un souci d'envoi —
        // c'est déjà journalisé au niveau du service e-mail système si besoin.
      }
      await recordAuditLog({
        actorType: "PLATFORM_ADMIN",
        platformAdminId: admin.id,
        action: "ADMIN_PASSWORD_RESET_REQUESTED",
        ipAddress: req.ip ?? null,
      });
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

    const adminId = await consumePasswordResetToken("PLATFORM_ADMIN", parsed.data.token);
    if (!adminId) {
      throw new HttpError(400, "INVALID_OR_EXPIRED_TOKEN");
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.platformAdmin.update({ where: { id: adminId }, data: { passwordHash } });

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: adminId,
      action: "ADMIN_PASSWORD_RESET_COMPLETED",
      ipAddress: req.ip ?? null,
    });

    res.json({ ok: true });
  }),
);

export default router;
