import nodemailer from "nodemailer";

export interface SmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoie un e-mail réel via le SMTP propre à l'entreprise (jamais un compte partagé par toute
 * la plateforme — chaque entreprise envoie depuis sa propre adresse, avec sa propre réputation
 * d'expéditeur). Un nouveau transport est créé à chaque appel : le volume ici (relances/promos
 * envoyées manuellement par un employé) ne justifie pas de mettre en cache une connexion par
 * entreprise.
 */
export async function sendEmail(credentials: SmtpCredentials, input: SendEmailInput): Promise<void> {
  const transport = nodemailer.createTransport({
    host: credentials.smtpHost,
    port: credentials.smtpPort,
    secure: credentials.smtpSecure,
    auth: { user: credentials.smtpUser, pass: credentials.smtpPassword },
  });

  await transport.sendMail({
    from: credentials.fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
