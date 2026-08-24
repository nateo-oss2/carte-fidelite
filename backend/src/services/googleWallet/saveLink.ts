import jwt from "jsonwebtoken";
import { getServiceAccountEmail, getServiceAccountPrivateKey } from "./config";

/**
 * Construit le lien "Ajouter à Google Wallet" : un JWT signé (RS256) par la clé privée du
 * compte de service, référençant l'objet de fidélité déjà créé côté Google. Cliquer ce lien
 * ouvre Google Wallet, qui vérifie la signature avant d'ajouter la carte.
 */
export function buildSaveToGoogleWalletUrl(loyaltyObjectId: string): string {
  const payload = {
    iss: getServiceAccountEmail(),
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      loyaltyObjects: [{ id: loyaltyObjectId }],
    },
  };

  const token = jwt.sign(payload, getServiceAccountPrivateKey(), { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
