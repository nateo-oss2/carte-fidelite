import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { createTerminal } from "../services/terminalAuth";
import { prisma } from "../prisma";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

/**
 * GET /company/:slug/terminals — liste les clés API externes de l'entreprise (jamais la clé
 * elle-même, seul son hash est conservé en base — voir createTerminal).
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const terminals = await prisma.terminal.findMany({
      where: { companyId: req.employee!.companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, active: true, createdAt: true },
    });
    res.json({ terminals });
  }),
);

const createTerminalSchema = z.object({
  label: z.string().trim().min(1).max(80),
});

/**
 * POST /company/:slug/terminals — crée une nouvelle clé API (ex: pour brancher un logiciel de
 * caisse externe ou un automate Zapier/Make). La clé brute n'est renvoyée qu'ici, une seule
 * fois — comme pour tout autre secret de cette plateforme.
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createTerminalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const { terminal, rawApiKey } = await createTerminal(req.employee!.companyId, parsed.data.label);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "TERMINAL_CREATED",
      targetType: "Terminal",
      targetId: terminal.id,
      metadata: { label: terminal.label },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ id: terminal.id, label: terminal.label, apiKey: rawApiKey });
  }),
);

/** PATCH /company/:slug/terminals/:id — active/révoque une clé API existante. */
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const terminal = await prisma.terminal.findUnique({ where: { id: req.params.id } });
    if (!terminal || terminal.companyId !== req.employee!.companyId) {
      throw new HttpError(404, "TERMINAL_NOT_FOUND");
    }

    const updated = await prisma.terminal.update({
      where: { id: terminal.id },
      data: { active: parsed.data.active },
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: parsed.data.active ? "TERMINAL_REACTIVATED" : "TERMINAL_REVOKED",
      targetType: "Terminal",
      targetId: terminal.id,
      ipAddress: req.ip ?? null,
    });

    res.json({ id: updated.id, label: updated.label, active: updated.active });
  }),
);

export default router;
