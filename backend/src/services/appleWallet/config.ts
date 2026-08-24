/** true si de vraies credentials Apple Developer sont configurées dans l'environnement. */
export function isAppleWalletConfigured(): boolean {
  return Boolean(
    process.env.APPLE_TEAM_IDENTIFIER &&
      process.env.APPLE_PASS_TYPE_IDENTIFIER &&
      process.env.APPLE_PASS_SIGNER_CERT_PATH &&
      process.env.APPLE_PASS_SIGNER_KEY_PATH &&
      process.env.APPLE_WWDR_CERTIFICATE_PATH,
  );
}
