import type { RequestHandler } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../prisma";
import { SESSION_COOKIE_NAME, verifyEmployeeSessionToken } from "../services/companyAuth";

/**
 * Exige une session employé valide (cookie httpOnly signé) ET que cet employé appartienne
 * bien à l'entreprise désignée par :slug dans l'URL — jamais confiance dans le slug seul.
 * Une entreprise suspendue/désactivée perd aussi l'accès à son propre dashboard.
 */
export const requireEmployeeAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const employeeId = typeof token === "string" ? verifyEmployeeSessionToken(token) : null;

  if (!employeeId) {
    res.status(401).json({ error: "NOT_AUTHENTICATED" });
    return;
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { company: true },
  });

  if (
    !employee ||
    !employee.active ||
    employee.company.slug !== req.params.slug ||
    employee.company.status !== "ACTIVE"
  ) {
    res.status(401).json({ error: "NOT_AUTHENTICATED" });
    return;
  }

  req.employee = {
    id: employee.id,
    companyId: employee.companyId,
    role: employee.role,
    name: employee.name,
  };
  next();
});

/** À utiliser après requireEmployeeAuth : restreint la route aux rôles listés. */
export function requireEmployeeRole(...roles: Array<"ADMIN" | "MANAGER" | "EMPLOYEE">): RequestHandler {
  return (req, res, next) => {
    if (!req.employee || !roles.includes(req.employee.role as "ADMIN" | "MANAGER" | "EMPLOYEE")) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    next();
  };
}
