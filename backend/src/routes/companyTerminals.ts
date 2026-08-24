import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { createTerminal, listTerminals, setTerminalActive } from "../services/terminalAuth";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

// Gérer les terminaux (postes de caisse) est réservé aux ADMIN de l'entreprise — un terminal
// actif suffit à créer des transactions, au même titre qu'un accès employé.
router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const terminals = await listTerminals(req.employee!.companyId);
    res.json({ terminals });
  }),
);

const createTerminalSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

/** POST /company/:slug/terminals — enregistre un nouveau poste de caisse/scan. */
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
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ id: terminal.id, label: terminal.label, apiKey: rawApiKey });
  }),
);

const updateTerminalSchema = z.object({
  active: z.boolean(),
});

router.patch(
  "/:terminalId",
  asyncHandler(async (req, res) => {
    const parsed = updateTerminalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const terminal = await setTerminalActive(req.employee!.companyId, req.params.terminalId, parsed.data.active);
    if (!terminal) {
      throw new HttpError(404, "TERMINAL_NOT_FOUND");
    }

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "TERMINAL_UPDATED",
      targetType: "Terminal",
      targetId: terminal.id,
      metadata: { active: terminal.active },
      ipAddress: req.ip ?? null,
    });

    res.json({ id: terminal.id, label: terminal.label, active: terminal.active });
  }),
);

export default router;
