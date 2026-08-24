import { prisma } from "../prisma";
import { generateOpaqueSecret, sha256Hex } from "../lib/crypto";

/**
 * Enregistre un nouveau terminal autorisé pour une entreprise (poste de caisse, appareil de scan).
 * Retourne la clé API brute UNE SEULE FOIS — seul son hash est conservé en base.
 */
export async function createTerminal(companyId: string, label: string) {
  const rawApiKey = generateOpaqueSecret();
  const terminal = await prisma.terminal.create({
    data: { companyId, label, apiKeyHash: sha256Hex(rawApiKey) },
  });
  return { terminal, rawApiKey };
}

/** Authentifie un terminal à partir de la clé API brute présentée dans l'en-tête de requête. */
export async function authenticateTerminal(rawApiKey: string) {
  const apiKeyHash = sha256Hex(rawApiKey);
  const terminal = await prisma.terminal.findUnique({ where: { apiKeyHash } });
  if (!terminal || !terminal.active) {
    return null;
  }
  return terminal;
}

export async function listTerminals(companyId: string) {
  const terminals = await prisma.terminal.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  return terminals.map((t) => ({ id: t.id, label: t.label, active: t.active, createdAt: t.createdAt }));
}

export async function setTerminalActive(companyId: string, terminalId: string, active: boolean) {
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
  if (!terminal || terminal.companyId !== companyId) {
    return null;
  }
  return prisma.terminal.update({ where: { id: terminalId }, data: { active } });
}
