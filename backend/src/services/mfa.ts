import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

/** Génère un secret TOTP compatible Google Authenticator / Authy / etc. */
export function generateMfaSecret(): string {
  return generateSecret();
}

/** URL otpauth:// standard, encodée en QR code pour que l'app d'authentification le scanne. */
export async function generateMfaSetupQrCode(secret: string, email: string): Promise<string> {
  const otpauthUrl = generateURI({ issuer: "Carte Virtuelle — Admin", label: email, secret });
  return QRCode.toDataURL(otpauthUrl, { margin: 2 });
}

/** Vérifie un code à 6 chiffres saisi par l'utilisateur contre son secret. */
export async function verifyMfaCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code });
    return result.valid;
  } catch {
    return false;
  }
}
