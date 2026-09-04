import { readFileSync } from "fs";
import { PKPass } from "passkit-generator";
import { buildPassJson } from "./buildPassJson";
import { createSolidColorPng } from "./placeholderImage";
import { isAppleWalletConfigured } from "./config";
import { HttpError } from "../../lib/httpError";

interface BuildPassInput {
  companyName: string;
  accentColor: string;
  serialNumber: string;
  authenticationToken: string;
  barcodeMessage: string;
  /** Affiché en texte sous le code-barres — pour une saisie manuelle s'il ne scanne pas. */
  loyaltyNumber: string;
}

/**
 * Signe et empaquette un vrai fichier .pkpass. Nécessite les vraies credentials Apple
 * Developer (certificat Pass Type ID + WWDR) — voir backend/.env.example pour les obtenir.
 * Lève APPLE_WALLET_NOT_CONFIGURED tant qu'elles ne sont pas renseignées.
 */
export async function buildApplePkpass(input: BuildPassInput): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new HttpError(
      503,
      "APPLE_WALLET_NOT_CONFIGURED",
      "Les credentials Apple Developer (certificat Pass Type ID + WWDR) ne sont pas configurées sur ce serveur.",
    );
  }

  const webServiceURL = `${process.env.API_BASE_URL}/wallet/apple`;

  const passJson = buildPassJson({
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER!,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER!,
    companyName: input.companyName,
    accentColor: input.accentColor,
    serialNumber: input.serialNumber,
    authenticationToken: input.authenticationToken,
    webServiceURL,
    barcodeMessage: input.barcodeMessage,
    loyaltyNumber: input.loyaltyNumber,
  });

  // Icône blanche neutre en placeholder — à remplacer par le vrai logo de l'entreprise
  // une fois l'upload de logo disponible (Phase 8).
  const icon = createSolidColorPng(29, 29, [255, 255, 255, 255]);
  const icon2x = createSolidColorPng(58, 58, [255, 255, 255, 255]);
  const icon3x = createSolidColorPng(87, 87, [255, 255, 255, 255]);

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon,
      "icon@2x.png": icon2x,
      "icon@3x.png": icon3x,
    },
    {
      wwdr: readFileSync(process.env.APPLE_WWDR_CERTIFICATE_PATH!),
      signerCert: readFileSync(process.env.APPLE_PASS_SIGNER_CERT_PATH!),
      signerKey: readFileSync(process.env.APPLE_PASS_SIGNER_KEY_PATH!),
      signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE || undefined,
    },
  );

  return pass.getAsBuffer();
}
