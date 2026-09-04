import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requirePlatformAdmin } from "../middleware/platformAdminAuth";
import {
  createCompany,
  deleteCompany,
  getCompanyById,
  listCompanies,
  setCompanyStatus,
  updateCompany,
  updateCompanyLogo,
} from "../services/companies";
import { createEmployee } from "../services/employees";
import { recordAuditLog } from "../services/auditLog";
import { logoUpload } from "../lib/logoUpload";

const router = Router();

router.use(requirePlatformAdmin);

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // supprime les accents (é -> e, etc.)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/)
    .min(2)
    .max(80)
    .optional(),
  logoUrl: z.string().trim().url().max(500).optional(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  programName: z.string().trim().min(1).max(120).optional(),
  pointsPerCurrencyUnit: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .optional(),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const companies = await listCompanies();
    res.json({ companies });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const slug = parsed.data.slug || slugify(parsed.data.name);
    if (!slug) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await createCompany({ ...parsed.data, slug });

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_CREATED",
      targetType: "Company",
      targetId: company.id,
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      joinToken: company.joinToken,
      joinUrl: `${process.env.FRONTEND_BASE_URL}/join/${company.joinToken}`,
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const company = await getCompanyById(req.params.id);
    res.json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      programName: company.programName,
      accentColor: company.accentColor,
      pointsPerCurrencyUnit: company.pointsPerCurrencyUnit,
      status: company.status,
      joinToken: company.joinToken,
    });
  }),
);

/**
 * DELETE /admin/companies/:id — suppression définitive, réservée aux entreprises vides
 * (aucun client, aucune transaction). Sinon, utiliser /suspend pour couper l'accès sans
 * perdre l'historique.
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const company = await getCompanyById(req.params.id);
    await deleteCompany(req.params.id);

    await recordAuditLog({
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_DELETED",
      targetType: "Company",
      targetId: company.id,
      metadata: { name: company.name, slug: company.slug },
      ipAddress: req.ip ?? null,
    });

    res.status(204).end();
  }),
);

const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  programName: z.string().trim().min(1).max(120).optional(),
  pointsPerCurrencyUnit: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .optional(),
});

/** PATCH /admin/companies/:id — modifie le branding et la règle de points d'une entreprise existante. */
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const company = await updateCompany(req.params.id, parsed.data);

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_UPDATED",
      targetType: "Company",
      targetId: company.id,
      metadata: parsed.data,
      ipAddress: req.ip ?? null,
    });

    res.json({
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl,
      programName: company.programName,
      accentColor: company.accentColor,
      pointsPerCurrencyUnit: company.pointsPerCurrencyUnit,
    });
  }),
);

/** POST /admin/companies/:id/logo — remplace le logo (peut être appelé à tout moment, pas seulement à la création). */
router.post(
  "/:id/logo",
  logoUpload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "LOGO_FILE_REQUIRED");
    }

    const logoUrl = `${process.env.API_BASE_URL}/uploads/logos/${req.file.filename}`;
    const company = await updateCompanyLogo(req.params.id, logoUrl);

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_LOGO_UPDATED",
      targetType: "Company",
      targetId: company.id,
      ipAddress: req.ip ?? null,
    });

    res.json({ logoUrl: company.logoUrl });
  }),
);

/** POST /admin/companies/:id/suspend — coupe l'accès de l'entreprise sans supprimer ses données. */
router.post(
  "/:id/suspend",
  asyncHandler(async (req, res) => {
    const company = await setCompanyStatus(req.params.id, "SUSPENDED");

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_SUSPENDED",
      targetType: "Company",
      targetId: company.id,
      ipAddress: req.ip ?? null,
    });

    res.json({ id: company.id, status: company.status });
  }),
);

/** POST /admin/companies/:id/reactivate — rétablit l'accès d'une entreprise suspendue. */
router.post(
  "/:id/reactivate",
  asyncHandler(async (req, res) => {
    const company = await setCompanyStatus(req.params.id, "ACTIVE");

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "COMPANY_REACTIVATED",
      targetType: "Company",
      targetId: company.id,
      ipAddress: req.ip ?? null,
    });

    res.json({ id: company.id, status: company.status });
  }),
);

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("ADMIN"),
});

/**
 * POST /admin/companies/:id/employees — crée l'accès dashboard d'une entreprise (à remettre
 * au client une fois le contrat signé). Génère un mot de passe temporaire, renvoyé une seule
 * fois : à copier immédiatement, il ne sera plus jamais affiché.
 */
router.post(
  "/:id/employees",
  asyncHandler(async (req, res) => {
    const company = await getCompanyById(req.params.id);

    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const { employee, temporaryPassword } = await createEmployee({
      companyId: company.id,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    await recordAuditLog({
      companyId: company.id,
      actorType: "PLATFORM_ADMIN",
      platformAdminId: req.platformAdmin!.id,
      action: "EMPLOYEE_CREATED",
      targetType: "Employee",
      targetId: employee.id,
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({
      name: employee.name,
      email: employee.email,
      role: employee.role,
      temporaryPassword,
      loginUrl: `${process.env.FRONTEND_BASE_URL}/company/${company.slug}/login`,
    });
  }),
);

export default router;
