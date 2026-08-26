import { prisma } from "../prisma";
import { sendEmail, type SmtpCredentials } from "./email/sendEmail";
import { getDecryptedEmailConfig } from "./companyEmailConfig";

interface SendNotificationInput {
  companyId: string;
  employeeId: string;
  customerId: string;
  subject: string;
  message: string;
  emailConfig: SmtpCredentials;
}

interface SendResult {
  customerId: string;
  ok: boolean;
  reason?: "NO_EMAIL" | "SEND_FAILED";
}

/**
 * Envoie une notification e-mail à un client et journalise systématiquement le résultat
 * (succès ou échec) — pour garder un historique de ce qui a été communiqué, par qui, et quand.
 */
async function sendOne(input: SendNotificationInput): Promise<SendResult> {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.companyId !== input.companyId) {
    return { customerId: input.customerId, ok: false, reason: "NO_EMAIL" };
  }

  if (!customer.email) {
    await prisma.customerNotification.create({
      data: {
        companyId: input.companyId,
        customerId: customer.id,
        employeeId: input.employeeId,
        subject: input.subject,
        message: input.message,
        status: "FAILED",
        errorDetail: "CUSTOMER_HAS_NO_EMAIL",
      },
    });
    return { customerId: input.customerId, ok: false, reason: "NO_EMAIL" };
  }

  try {
    await sendEmail(input.emailConfig, { to: customer.email, subject: input.subject, text: input.message });
    await prisma.customerNotification.create({
      data: {
        companyId: input.companyId,
        customerId: customer.id,
        employeeId: input.employeeId,
        subject: input.subject,
        message: input.message,
        status: "SENT",
      },
    });
    return { customerId: input.customerId, ok: true };
  } catch (error) {
    await prisma.customerNotification.create({
      data: {
        companyId: input.companyId,
        customerId: customer.id,
        employeeId: input.employeeId,
        subject: input.subject,
        message: input.message,
        status: "FAILED",
        errorDetail: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      },
    });
    return { customerId: input.customerId, ok: false, reason: "SEND_FAILED" };
  }
}

export type SendNotificationsResult =
  | { configured: false }
  | { configured: true; results: SendResult[] };

export async function sendNotifications(
  companyId: string,
  employeeId: string,
  customerIds: string[],
  subject: string,
  message: string,
): Promise<SendNotificationsResult> {
  // Config récupérée UNE fois pour tout l'envoi groupé, pas par destinataire.
  const emailConfig = await getDecryptedEmailConfig(companyId);
  if (!emailConfig) {
    return { configured: false };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const emailConfigWithFromName: SmtpCredentials = { ...emailConfig, fromName: company?.name };

  const results: SendResult[] = [];
  for (const customerId of customerIds) {
    // Séquentiel, volontairement : évite de saturer le fournisseur SMTP sur un envoi groupé.
    results.push(
      await sendOne({ companyId, employeeId, customerId, subject, message, emailConfig: emailConfigWithFromName }),
    );
  }
  return { configured: true, results };
}
