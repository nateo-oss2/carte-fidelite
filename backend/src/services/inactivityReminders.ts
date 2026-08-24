import { prisma } from "../prisma";
import { sendEmail } from "./email/sendEmail";
import { getDecryptedEmailConfig } from "./companyEmailConfig";

/**
 * Trouve, pour une entreprise donnée, les clients à relancer aujourd'hui : carte active,
 * e-mail renseigné, dernière activité (achat, ou inscription si jamais acheté) plus ancienne
 * que le seuil configuré, et jamais relancés depuis au moins ce même seuil — ce qui permet la
 * répétition périodique sans spammer plus d'une fois par période d'inactivité.
 */
async function findCustomersDueForReminder(companyId: string, thresholdDays: number) {
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      email: { not: null },
      tokens: { some: { status: "ACTIVE" } },
      OR: [{ lastAutoReminderSentAt: null }, { lastAutoReminderSentAt: { lte: cutoff } }],
    },
    include: {
      transactions: {
        where: { type: "PURCHASE", status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return customers.filter((customer) => {
    const lastActivity = customer.transactions[0]?.createdAt ?? customer.createdAt;
    return lastActivity <= cutoff;
  });
}

interface RunResult {
  companyId: string;
  companyName: string;
  sent: number;
  failed: number;
}

/** Exécute la relance d'inactivité pour une seule entreprise. Ne fait rien si mal configurée. */
export async function runInactivityRemindersForCompany(companyId: string): Promise<RunResult | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.status !== "ACTIVE" || !company.inactivityReminderEnabled) {
    return null;
  }

  const emailConfig = await getDecryptedEmailConfig(companyId);
  if (!emailConfig) {
    return null;
  }

  const due = await findCustomersDueForReminder(companyId, company.inactivityThresholdDays);
  let sent = 0;
  let failed = 0;

  for (const customer of due) {
    try {
      await sendEmail(emailConfig, {
        to: customer.email!,
        subject: company.inactivityReminderSubject,
        text: company.inactivityReminderMessage,
      });
      await prisma.$transaction([
        prisma.customerNotification.create({
          data: {
            companyId,
            customerId: customer.id,
            origin: "AUTOMATIC",
            subject: company.inactivityReminderSubject,
            message: company.inactivityReminderMessage,
            status: "SENT",
          },
        }),
        prisma.customer.update({ where: { id: customer.id }, data: { lastAutoReminderSentAt: new Date() } }),
      ]);
      sent++;
    } catch (error) {
      await prisma.customerNotification.create({
        data: {
          companyId,
          customerId: customer.id,
          origin: "AUTOMATIC",
          subject: company.inactivityReminderSubject,
          message: company.inactivityReminderMessage,
          status: "FAILED",
          errorDetail: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        },
      });
      failed++;
    }
  }

  return { companyId, companyName: company.name, sent, failed };
}

/** Exécutée quotidiennement par le planificateur — parcourt toutes les entreprises actives. */
export async function runAllInactivityReminders(): Promise<RunResult[]> {
  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE", inactivityReminderEnabled: true },
    select: { id: true },
  });

  const results: RunResult[] = [];
  for (const company of companies) {
    const result = await runInactivityRemindersForCompany(company.id);
    if (result) results.push(result);
  }
  return results;
}
