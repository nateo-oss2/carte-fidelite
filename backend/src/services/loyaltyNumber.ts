import { randomInt } from "crypto";

/**
 * Numéro de fidélité lisible (non secret) affiché sous le code-barres, ex: "4471 9902 5518".
 * Ce n'est PAS le token du code-barres — uniquement une référence humaine, sans valeur
 * d'authentification. L'unicité réelle est appliquée par la contrainte @unique en base ;
 * en cas de collision (improbable sur 12 chiffres), l'appelant doit réessayer.
 */
export function generateLoyaltyNumber(): string {
  const groups = [randomInt(0, 10000), randomInt(0, 10000), randomInt(0, 10000)];
  return groups.map((n) => n.toString().padStart(4, "0")).join(" ");
}
