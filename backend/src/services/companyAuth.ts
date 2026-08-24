import jwt from "jsonwebtoken";

const SESSION_COOKIE_NAME = "company_session";
const SESSION_DURATION = "12h";

export { SESSION_COOKIE_NAME };

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  }
  return secret;
}

export function signEmployeeSessionToken(employeeId: string): string {
  return jwt.sign({ sub: employeeId }, getSecret(), { expiresIn: SESSION_DURATION });
}

/** Retourne l'id de l'employé si le jeton est valide, sinon null (jamais ne lève). */
export function verifyEmployeeSessionToken(token: string): string | null {
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
