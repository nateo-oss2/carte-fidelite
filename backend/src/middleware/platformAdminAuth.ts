import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../prisma";
import { SESSION_COOKIE_NAME, verifyAdminSessionToken } from "../services/platformAdminAuth";

/** Exige une session administrateur valide (cookie httpOnly signé). */
export const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const adminId = typeof token === "string" ? verifyAdminSessionToken(token) : null;

  if (!adminId) {
    res.status(401).json({ error: "NOT_AUTHENTICATED" });
    return;
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
  if (!admin || !admin.active) {
    res.status(401).json({ error: "NOT_AUTHENTICATED" });
    return;
  }

  req.platformAdmin = { id: admin.id, email: admin.email };
  next();
});
