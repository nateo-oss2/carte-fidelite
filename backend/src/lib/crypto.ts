import { randomBytes, createHash } from "crypto";

// Alphabet Crockford Base32 : pas de 0/O ni 1/I/L, évite les confusions à la lecture/scan.
const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Secret opaque aléatoire (tokens clients, clés API de terminal...) — jamais dérivé de données prévisibles. */
export function generateOpaqueSecret(byteLength = 20): string {
  return toBase32(randomBytes(byteLength));
}

/** Hash à sens unique utilisé pour stocker un secret sans jamais le garder en clair en base. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
