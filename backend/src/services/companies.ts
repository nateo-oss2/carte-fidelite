import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../lib/httpError";

export interface CreateCompanyInput {
  name: string;
  slug: string;
  logoUrl?: string;
  accentColor?: string;
  programName?: string;
  pointsPerCurrencyUnit?: string;
}

export async function createCompany(input: CreateCompanyInput) {
  try {
    return await prisma.company.create({
      data: {
        name: input.name,
        slug: input.slug,
        logoUrl: input.logoUrl,
        accentColor: input.accentColor,
        programName: input.programName,
        pointsPerCurrencyUnit: input.pointsPerCurrencyUnit,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("slug")
    ) {
      throw new HttpError(409, "SLUG_ALREADY_TAKEN");
    }
    throw error;
  }
}

export async function getCompanyById(id: string) {
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    throw new HttpError(404, "COMPANY_NOT_FOUND");
  }
  return company;
}

export interface UpdateCompanyInput {
  name?: string;
  programName?: string;
  accentColor?: string;
  secondaryColor?: string | null;
  cardTemplate?: "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";
  pointsPerCurrencyUnit?: string;
}

export async function updateCompany(id: string, input: UpdateCompanyInput) {
  await getCompanyById(id);
  return prisma.company.update({ where: { id }, data: input });
}

export async function updateCompanyLogo(id: string, logoUrl: string) {
  await getCompanyById(id);
  return prisma.company.update({ where: { id }, data: { logoUrl } });
}

/**
 * Suspend une entreprise : coupe immédiatement l'inscription de nouveaux clients (le lien/QR
 * cesse de fonctionner), les nouvelles transactions (déjà bloquées côté service transactions)
 * et l'accès de ses employés à leur dashboard — sans supprimer aucune donnée.
 */
export async function setCompanyStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "DISABLED") {
  await getCompanyById(id);
  return prisma.company.update({ where: { id }, data: { status } });
}

/**
 * Supprime définitivement une entreprise — réservé aux entreprises réellement vides (aucun
 * client, aucune transaction). Une entreprise avec un historique réel ne doit jamais être
 * supprimée (ça détruirait le ledger, contraire à toute la logique anti-fraude du système) :
 * pour ce cas, utiliser setCompanyStatus(id, "DISABLED") à la place, qui coupe l'accès sans
 * perdre de données.
 */
export async function deleteCompany(id: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id },
    include: { _count: { select: { customers: true, transactions: true } } },
  });
  if (!company) {
    throw new HttpError(404, "COMPANY_NOT_FOUND");
  }
  if (company._count.customers > 0 || company._count.transactions > 0) {
    throw new HttpError(
      409,
      "COMPANY_NOT_EMPTY",
      "Cette entreprise a des clients ou des transactions — suspendez-la plutôt que de la supprimer, pour ne pas perdre son historique.",
    );
  }

  await prisma.$transaction([
    prisma.employee.deleteMany({ where: { companyId: id } }),
    prisma.terminal.deleteMany({ where: { companyId: id } }),
    prisma.reward.deleteMany({ where: { companyId: id } }),
    prisma.discountTier.deleteMany({ where: { companyId: id } }),
    prisma.company.delete({ where: { id } }),
  ]);
}

export async function listCompanies() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { customers: true, transactions: true } } },
  });

  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    status: company.status,
    accentColor: company.accentColor,
    joinToken: company.joinToken,
    customersCount: company._count.customers,
    transactionsCount: company._count.transactions,
    createdAt: company.createdAt,
  }));
}
