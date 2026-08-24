import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../lib/httpError";

export async function listDiscountTiers(companyId: string) {
  return prisma.discountTier.findMany({
    where: { companyId },
    orderBy: { thresholdPoints: "asc" },
  });
}

export async function createDiscountTier(
  companyId: string,
  label: string,
  thresholdPoints: number,
  discountPercent: string,
) {
  try {
    return await prisma.discountTier.create({
      data: { companyId, label, thresholdPoints, discountPercent: new Prisma.Decimal(discountPercent) },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("thresholdPoints")
    ) {
      throw new HttpError(409, "THRESHOLD_ALREADY_USED");
    }
    throw error;
  }
}

export interface UpdateDiscountTierInput {
  label?: string;
  thresholdPoints?: number;
  discountPercent?: string;
}

export async function updateDiscountTier(companyId: string, tierId: string, input: UpdateDiscountTierInput) {
  const tier = await prisma.discountTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.companyId !== companyId) {
    throw new HttpError(404, "DISCOUNT_TIER_NOT_FOUND");
  }
  return prisma.discountTier.update({
    where: { id: tierId },
    data: {
      label: input.label,
      thresholdPoints: input.thresholdPoints,
      discountPercent: input.discountPercent !== undefined ? new Prisma.Decimal(input.discountPercent) : undefined,
    },
  });
}

export async function deleteDiscountTier(companyId: string, tierId: string) {
  const tier = await prisma.discountTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.companyId !== companyId) {
    throw new HttpError(404, "DISCOUNT_TIER_NOT_FOUND");
  }
  await prisma.discountTier.delete({ where: { id: tierId } });
}

/** Retourne le palier applicable au cumul de points donné (le plus haut palier atteint), ou null. */
export function resolveApplicableTier<T extends { thresholdPoints: number }>(
  tiers: T[],
  lifetimePoints: number,
): T | null {
  const eligible = tiers.filter((t) => t.thresholdPoints <= lifetimePoints);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, t) => (t.thresholdPoints > best.thresholdPoints ? t : best));
}
