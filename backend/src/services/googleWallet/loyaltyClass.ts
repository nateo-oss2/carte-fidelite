import { getIssuerId, isGoogleWalletConfigured } from "./config";
import { upsertWalletResource } from "./restClient";
import { HttpError } from "../../lib/httpError";

interface CompanyForClass {
  slug: string;
  name: string;
  logoUrl: string | null;
}

/** L'id de classe Google Wallet est stable pour une entreprise donnée (un programme = une classe). */
export function buildLoyaltyClassId(company: CompanyForClass): string {
  return `${getIssuerId()}.company_${company.slug.replace(/-/g, "_")}`;
}

/**
 * Une classe Google Wallet regroupe tout ce qui est commun à TOUS les clients d'une même
 * entreprise (branding). Conforme au design validé (Phase 1) : uniquement logo + nom sur la
 * carte, aucun champ de points/récompense visible.
 */
function buildLoyaltyClassPayload(company: CompanyForClass) {
  if (!company.logoUrl) {
    // Contrairement à Apple (qui embarque directement le fichier image dans le pass),
    // Google Wallet exige une URL HTTPS publique vers le logo — il n'y a pas encore de
    // système d'upload/hébergement de logo (Phase 8). Erreur explicite plutôt qu'un
    // placeholder externe non maîtrisé.
    throw new HttpError(
      503,
      "GOOGLE_WALLET_LOGO_URL_REQUIRED",
      "Google Wallet exige une URL publique vers le logo de l'entreprise (company.logoUrl manquant).",
    );
  }

  return {
    id: buildLoyaltyClassId(company),
    issuerName: company.name,
    programName: company.name,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: "#FFFFFF",
    programLogo: {
      sourceUri: { uri: company.logoUrl },
    },
  };
}

export async function ensureLoyaltyClass(company: CompanyForClass): Promise<string> {
  if (!isGoogleWalletConfigured()) {
    throw new HttpError(
      503,
      "GOOGLE_WALLET_NOT_CONFIGURED",
      "Les credentials Google Wallet (issuer ID, compte de service) ne sont pas configurées sur ce serveur.",
    );
  }

  const payload = buildLoyaltyClassPayload(company);
  await upsertWalletResource("/loyaltyClass", payload.id, payload);
  return payload.id;
}
