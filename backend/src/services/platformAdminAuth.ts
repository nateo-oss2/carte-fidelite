import jwt from "jsonwebtoken";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION = "12h";

const MFA_PENDING_COOKIE_NAME = "admin_mfa_pending";
const MFA_PENDING_DURATION = "5m";

export { SESSION_COOKIE_NAME, MFA_PENDING_COOKIE_NAME };

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  }
  return secret;
}

export function signAdminSessionToken(adminId: string): string {
  return jwt.sign({ sub: adminId }, getSecret(), { expiresIn: SESSION_DURATION });
}

/** Retourne l'id de l'admin si le jeton de session est valide, sinon null (jamais ne lève). */
export function verifyAdminSessionToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === "object" && typeof decoded.sub === "string") {
      return decoded.sub;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Jeton intermédiaire émis juste après un mot de passe correct quand le MFA est activé —
 * n'accorde AUCUN accès par lui-même, juste le droit de présenter un code à l'étape suivante.
 * Volontairement à durée de vie très courte (5 minutes).
 */
export function signMfaPendingToken(adminId: string): string {
  return jwt.sign({ sub: adminId, purpose: "mfa_pending" }, getSecret(), { expiresIn: MFA_PENDING_DURATION });
}

export function verifyMfaPendingToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === "object" && decoded.purpose === "mfa_pending" && typeof decoded.sub === "string") {
      return decoded.sub;
    }
    return null;
  } catch {
    return null;
  }
}
