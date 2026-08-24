import { getIssuerId, isGoogleWalletConfigured } from "./config";
import { upsertWalletResource } from "./restClient";
import { HttpError } from "../../lib/httpError";

interface BuildLoyaltyObjectInput {
  classId: string;
  serialNumber: string;
  /** Token brut du client, encodé tel quel dans le code-barres. */
  barcodeMessage: string;
}

export function buildLoyaltyObjectId(serialNumber: string): string {
  return `${getIssuerId()}.${serialNumber}`;
}

/**
 * L'objet Google Wallet est propre à un client — mais, comme pour Apple, ne porte aucune
 * donnée de points/récompense : uniquement l'identité de programme (héritée de la classe)
 * et le code-barres. Le solde et les récompenses restent exclusifs à l'écran du staff.
 */
function buildLoyaltyObjectPayload(input: BuildLoyaltyObjectInput) {
  return {
    id: buildLoyaltyObjectId(input.serialNumber),
    classId: input.classId,
    state: "ACTIVE",
    barcode: {
      type: "CODE_128",
      value: input.barcodeMessage,
    },
  };
}

export async function ensureLoyaltyObject(input: BuildLoyaltyObjectInput): Promise<string> {
  if (!isGoogleWalletConfigured()) {
    throw new HttpError(
      503,
      "GOOGLE_WALLET_NOT_CONFIGURED",
      "Les credentials Google Wallet (issuer ID, compte de service) ne sont pas configurées sur ce serveur.",
    );
  }

  const payload = buildLoyaltyObjectPayload(input);
  await upsertWalletResource("/loyaltyObject", payload.id, payload);
  return payload.id;
}
