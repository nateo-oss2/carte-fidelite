import { prisma } from "../prisma";
import { generateOpaqueSecret } from "../lib/crypto";

/** Récupère le pass Apple actif d'un client, ou en crée un nouveau (numéro de série + jeton d'auth). */
export async function getOrCreateApplePass(customerId: string, companyId: string) {
  const existing = await prisma.walletPass.findUnique({
    where: { companyId_customerId_walletType: { companyId, customerId, walletType: "APPLE" } },
  });
  if (existing) {
    return existing;
  }

  return prisma.walletPass.create({
    data: {
      companyId,
      customerId,
      walletType: "APPLE",
      passIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER ?? "pass.com.example.loyalty",
      serialNumber: generateOpaqueSecret(16),
      appleAuthToken: generateOpaqueSecret(16),
      status: "ACTIVE",
    },
  });
}

/** Récupère le pass Google actif d'un client, ou en crée un nouveau (numéro de série). */
export async function getOrCreateGooglePass(customerId: string, companyId: string, classId: string) {
  const existing = await prisma.walletPass.findUnique({
    where: { companyId_customerId_walletType: { companyId, customerId, walletType: "GOOGLE" } },
  });
  if (existing) {
    return existing;
  }

  return prisma.walletPass.create({
    data: {
      companyId,
      customerId,
      walletType: "GOOGLE",
      passIdentifier: classId,
      serialNumber: generateOpaqueSecret(16),
      status: "ACTIVE",
    },
  });
}
