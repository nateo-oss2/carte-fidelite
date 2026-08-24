import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireEmployeeAuth, requireEmployeeRole } from "../middleware/companyAuth";
import { createEmployee, listEmployees, updateEmployee } from "../services/employees";
import { recordAuditLog } from "../services/auditLog";

const router = Router({ mergeParams: true });

// Gérer les employés est réservé aux ADMIN de l'entreprise (jamais un simple EMPLOYEE —
// section 18 du brief : un employé ne doit pas pouvoir créer des administrateurs).
router.use(requireEmployeeAuth, requireEmployeeRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const employees = await listEmployees(req.employee!.companyId);
    res.json({ employees });
  }),
);

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const { employee, temporaryPassword } = await createEmployee({
      companyId: req.employee!.companyId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "EMPLOYEE_CREATED",
      targetType: "Employee",
      targetId: employee.id,
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ name: employee.name, email: employee.email, role: employee.role, temporaryPassword });
  }),
);

const updateEmployeeSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
  active: z.boolean().optional(),
});

router.patch(
  "/:employeeId",
  asyncHandler(async (req, res) => {
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    if (req.params.employeeId === req.employee!.id && parsed.data.active === false) {
      throw new HttpError(400, "CANNOT_DEACTIVATE_SELF");
    }

    const employee = await updateEmployee(req.employee!.companyId, req.params.employeeId, parsed.data);

    await recordAuditLog({
      companyId: req.employee!.companyId,
      actorType: "EMPLOYEE",
      employeeId: req.employee!.id,
      action: "EMPLOYEE_UPDATED",
      targetType: "Employee",
      targetId: employee.id,
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({ id: employee.id, name: employee.name, role: employee.role, active: employee.active });
  }),
);

export default router;
