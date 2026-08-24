export interface ApplePassInput {
  passTypeIdentifier: string;
  teamIdentifier: string;
  companyName: string;
  accentColor: string;
  serialNumber: string;
  authenticationToken: string;
  webServiceURL: string;
  /** Token brut du client, encodé tel quel dans le code-barres. */
  barcodeMessage: string;
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Construit le pass.json — conforme au design validé en Phase 1 : face principale réduite
 * au logo + nom d'entreprise (aucun champ primaire/secondaire), le code-barres apparaît
 * naturellement dans la zone qui se déplie quand le client ouvre le pass.
 */
export function buildPassJson(input: ApplePassInput) {
  return {
    formatVersion: 1,
    passTypeIdentifier: input.passTypeIdentifier,
    teamIdentifier: input.teamIdentifier,
    organizationName: input.companyName,
    description: `Carte de fidélité ${input.companyName}`,
    serialNumber: input.serialNumber,
    authenticationToken: input.authenticationToken,
    webServiceURL: input.webServiceURL,
    logoText: input.companyName,
    backgroundColor: "rgb(255, 255, 255)",
    foregroundColor: "rgb(23, 21, 18)",
    labelColor: hexToRgb(input.accentColor),
    storeCard: {
      headerFields: [],
      primaryFields: [],
      secondaryFields: [],
      auxiliaryFields: [],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatCode128",
        message: input.barcodeMessage,
        messageEncoding: "iso-8859-1",
      },
    ],
  };
}
