import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

/**
 * Railway (comme la plupart des hébergeurs) ne garde aucun fichier entre deux déploiements —
 * on ne peut donc pas simplement déposer les certificats Apple Wallet sur le disque une fois
 * pour toutes. À la place, leur contenu (encodé en base64) est stocké dans des variables
 * d'environnement, et cette fonction les réécrit sur le disque à chaque démarrage du serveur,
 * puis pointe les variables *_PATH attendues par appleWallet/config.ts vers ces fichiers frais.
 *
 * Sans effet si les variables base64 ne sont pas renseignées (Apple Wallet reste non configuré,
 * exactement comme avant — voir isAppleWalletConfigured()).
 */
export function bootstrapAppleWalletCerts(): void {
  const certB64 = process.env.APPLE_PASS_SIGNER_CERT_B64;
  const keyB64 = process.env.APPLE_PASS_SIGNER_KEY_B64;
  const wwdrB64 = process.env.APPLE_WWDR_CERTIFICATE_B64;

  if (!certB64 || !keyB64 || !wwdrB64) {
    return;
  }

  const dir = path.join(os.tmpdir(), "apple-wallet-certs");
  mkdirSync(dir, { recursive: true });

  const certPath = path.join(dir, "signerCert.pem");
  const keyPath = path.join(dir, "signerKey.pem");
  const wwdrPath = path.join(dir, "wwdr.pem");

  writeFileSync(certPath, Buffer.from(certB64, "base64"));
  writeFileSync(keyPath, Buffer.from(keyB64, "base64"));
  writeFileSync(wwdrPath, Buffer.from(wwdrB64, "base64"));

  process.env.APPLE_PASS_SIGNER_CERT_PATH = certPath;
  process.env.APPLE_PASS_SIGNER_KEY_PATH = keyPath;
  process.env.APPLE_WWDR_CERTIFICATE_PATH = wwdrPath;
}
