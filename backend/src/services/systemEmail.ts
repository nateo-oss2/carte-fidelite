import nodemailer from "nodemailer";

/**
 * E-mails "système" (réinitialisation de mot de passe, alertes de sécurité) — distincts des
 * e-mails que chaque entreprise envoie à ses propres clients (Resend par entreprise). Ceux-ci
 * viennent de la plateforme elle-même, donc une seule configuration, au niveau serveur.
 */
export function isSystemEmailConfigured(): boolean {
  return Boolean(
    process.env.SYSTEM_SMTP_HOST &&
      process.env.SYSTEM_SMTP_USER &&
      process.env.SYSTEM_SMTP_PASSWORD &&
      process.env.SYSTEM_EMAIL_FROM_ADDRESS,
  );
}

interface SendSystemEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendSystemEmail(input: SendSystemEmailInput): Promise<void> {
  if (!isSystemEmailConfigured()) {
    throw new Error("SYSTEM_EMAIL_NOT_CONFIGURED");
  }

  const transport = nodemailer.createTransport({
    host: process.env.SYSTEM_SMTP_HOST,
    port: Number(process.env.SYSTEM_SMTP_PORT) || 587,
    secure: process.env.SYSTEM_SMTP_SECURE === "true",
    auth: { user: process.env.SYSTEM_SMTP_USER, pass: process.env.SYSTEM_SMTP_PASSWORD },
  });

  await transport.sendMail({
    from: process.env.SYSTEM_EMAIL_FROM_ADDRESS,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
