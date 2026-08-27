import cron from "node-cron";
import { runAllPointsExpiry } from "../services/pointsExpiry";

/** Planifie l'expiration des points inutilisés une fois par jour (4h, heure du serveur). */
export function startPointsExpiryScheduler(): void {
  cron.schedule("0 4 * * *", () => {
    runAllPointsExpiry()
      .then((results) => {
        if (results.length > 0) {
          console.log(`[expiration des points] ${results.length} entreprise(s) traitée(s)`, results);
        }
      })
      .catch((error) => {
        console.error("[expiration des points] échec de l'exécution planifiée", error);
      });
  });
}
