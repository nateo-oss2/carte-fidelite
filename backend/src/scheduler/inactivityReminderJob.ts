import cron from "node-cron";
import { runAllInactivityReminders } from "../services/inactivityReminders";

/**
 * Planifie la relance d'inactivité une fois par jour (9h, heure du serveur). Tourne dans le
 * même processus que l'API — suffisant pour un déploiement à instance unique. Si la plateforme
 * évolue vers plusieurs instances du serveur en parallèle, ce job devra être déplacé vers un
 * worker dédié pour éviter d'envoyer la même relance plusieurs fois.
 */
export function startInactivityReminderScheduler(): void {
  cron.schedule("0 9 * * *", () => {
    runAllInactivityReminders()
      .then((results) => {
        if (results.length > 0) {
          console.log(`[relances d'inactivité] ${results.length} entreprise(s) traitée(s)`, results);
        }
      })
      .catch((error) => {
        console.error("[relances d'inactivité] échec de l'exécution planifiée", error);
      });
  });
}
