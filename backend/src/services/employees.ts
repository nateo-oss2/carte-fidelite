import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../lib/httpError";
import { hashPassword } from "../lib/passwords";
import { generateOpaqueSecret } from "../lib/crypto";

export interface CreateEmployeeInput {
  companyId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
}

/**
 * Crée un accès employé et génère un mot de passe temporaire aléatoire.
 * Le mot de passe brut est retourné UNE SEULE FOIS — à transmettre immédiatement à
 * l'entreprise, il n'est jamais récupérable ensuite (seul son hash est stocké).
 */
export async function createEmployee(input: CreateEmployeeInput) {
  const temporaryPassword = generateOpaqueSecret(10);
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const employee = await prisma.employee.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
      },
    });
    return { employee, temporaryPassword };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("email")
    ) {
      throw new HttpError(409, "EMPLOYEE_EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function listEmployees(companyId: string) {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  return employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    active: e.active,
    createdAt: e.createdAt,
  }));
}

export interface UpdateEmployeeInput {
  role?: "ADMIN" | "MANAGER" | "EMPLOYEE";
  active?: boolean;
}

/**
 * Modifie le rôle ou le statut actif d'un employé — avec un garde-fou : on ne peut jamais
 * se retrouver avec zéro ADMIN actif dans une entreprise (ça la verrouillerait durablement,
 * plus personne ne pourrait gérer les accès sans intervention manuelle en base).
 */
export async function updateEmployee(companyId: string, employeeId: string, input: UpdateEmployeeInput) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.companyId !== companyId) {
    throw new HttpError(404, "EMPLOYEE_NOT_FOUND");
  }

  const willLoseAdminStatus =
    employee.role === "ADMIN" &&
    ((input.role && input.role !== "ADMIN") || (input.active === false && employee.active));

  if (willLoseAdminStatus) {
    const otherActiveAdmins = await prisma.employee.count({
      where: { companyId, role: "ADMIN", active: true, id: { not: employeeId } },
    });
    if (otherActiveAdmins === 0) {
      throw new HttpError(409, "LAST_ADMIN_CANNOT_BE_REMOVED");
    }
  }

  return prisma.employee.update({ where: { id: employeeId }, data: input });
}
