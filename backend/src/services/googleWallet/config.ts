/** true si de vraies credentials Google Wallet API sont configurées dans l'environnement. */
export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export function getIssuerId(): string {
  return process.env.GOOGLE_WALLET_ISSUER_ID!;
}

export function getServiceAccountEmail(): string {
  return process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
}

/** La clé privée est stockée en env avec des \n littéraux — à reconvertir en vrais retours à la ligne. */
export function getServiceAccountPrivateKey(): string {
  return process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
}
