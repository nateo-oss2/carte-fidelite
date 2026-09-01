export interface SmtpCredentials {
  /** Clé API Resend — celle de l'entreprise si elle en a une, sinon celle du compte partagé
   * de la plateforme (voir services/companyEmailConfig.ts). Nommé "smtpPassword" pour rester
   * compatible avec le nom historique du champ, même si Resend n'utilise pas SMTP. */
  smtpPassword: string;
  fromAddress: string;
  /** Nom affiché comme expéditeur (ex: "Café Lucine") — sans ça, seule l'adresse s'affiche. */
  fromName?: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoie un e-mail réel via l'API HTTP de Resend, avec la clé et l'adresse résolues par
 * getDecryptedEmailConfig (propres à l'entreprise, ou repli sur le compte partagé — voir ce
 * fichier pour la logique).
 *
 * Le SMTP classique (port 587/465) est bloqué par défaut sur Railway comme sur la plupart
 * des hébergeurs cloud (anti-spam) — d'où l'utilisation de l'API HTTP de Resend (port 443),
 * jamais bloquée.
 */
export async function sendEmail(credentials: SmtpCredentials, input: SendEmailInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.smtpPassword}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: credentials.fromName ? `${credentials.fromName} <${credentials.fromAddress}>` : credentials.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`RESEND_SEND_FAILED_${res.status}: ${body.message ?? "erreur inconnue"}`);
  }
}
