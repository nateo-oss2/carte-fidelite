import { prisma } from "../prisma";
import type { ActorType, Prisma } from "@prisma/client";

interface RecordAuditLogInput {
  companyId?: string | null;
  actorType: ActorType;
  employeeId?: string | null;
  platformAdminId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Écrit une entrée d'audit. Aucune route ne doit permettre de modifier ou supprimer ces entrées. */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId ?? null,
      actorType: input.actorType,
      employeeId: input.employeeId ?? null,
      platformAdminId: input.platformAdminId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
