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
 * Envoie un e-mail réel via l'API HTTP de Resend (jamais un compte partagé par toute la
 * plateforme — chaque entreprise envoie depuis sa propre clé, avec sa propre réputation
 * d'expéditeur). smtpPassword contient en réalité la clé API Resend — les champs
 * smtpHost/smtpPort/smtpSecure/smtpUser ne sont pas utilisés ici (hérités du modèle SMTP
 * générique initial) mais conservés en base pour compatibilité du schéma existant.
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
      from: credentials.fromAddress,
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
