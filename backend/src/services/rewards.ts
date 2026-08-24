import { prisma } from "../prisma";
import { HttpError } from "../lib/httpError";

export async function listRewards(companyId: string, activeOnly = false) {
  return prisma.reward.findMany({
    where: { companyId, ...(activeOnly ? { active: true } : {}) },
    orderBy: { pointsCost: "asc" },
  });
}

export async function createReward(companyId: string, name: string, pointsCost: number) {
  return prisma.reward.create({ data: { companyId, name, pointsCost } });
}

export interface UpdateRewardInput {
  name?: string;
  pointsCost?: number;
  active?: boolean;
}

export async function updateReward(companyId: string, rewardId: string, input: UpdateRewardInput) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.companyId !== companyId) {
    throw new HttpError(404, "REWARD_NOT_FOUND");
  }
  return prisma.reward.update({ where: { id: rewardId }, data: input });
}

export async function deleteReward(companyId: string, rewardId: string) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.companyId !== companyId) {
    throw new HttpError(404, "REWARD_NOT_FOUND");
  }
  await prisma.reward.delete({ where: { id: rewardId } });
}
