import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Chiffrement réversible (AES-256-GCM) — distinct du hash SHA-256 utilisé pour vérifier un
 * token au scan. Nécessaire uniquement pour reconstruire un pass Wallet à la demande d'Apple
 * (GET /v1/passes/...), potentiellement bien après l'émission du token, quand on n'a plus
 * sa valeur brute en mémoire. Ne JAMAIS utiliser cette valeur déchiffrée ailleurs qu'au moment
 * de régénérer un pass — la vérification au scan continue de passer exclusivement par le hash.
 */

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY_INVALID_LENGTH");
  }
  return key;
}

/** Retourne "iv.authTag.ciphertext" encodé en base64url, prêt à stocker en base. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64url")).join(".");
}

export function decryptToken(encoded: string): string {
  const key = getKey();
  const [ivPart, authTagPart, ciphertextPart] = encoded.split(".");
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error("ENCRYPTED_TOKEN_MALFORMED");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
