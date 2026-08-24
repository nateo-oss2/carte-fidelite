import cron from "node-cron";
import { runDatabaseBackup } from "../services/backup";

/**
 * Sauvegarde quotidienne (3h du matin, heure serveur). Comme pour les relances d'inactivité,
 * tourne dans le même processus — adapté à un déploiement à instance unique.
 *
 * IMPORTANT pour une vraie mise en production : cette implémentation utilise `docker exec`
 * pour dumper la base d'un conteneur Postgres LOCAL — c'est ce qu'on a sous la main en
 * développement. En production, avec un vrai fournisseur (Railway, Supabase, RDS...), il
 * faudra soit utiliser leurs sauvegardes automatiques natives (généralement la meilleure
 * option), soit adapter runDatabaseBackup() pour lancer pg_dump directement contre
 * DATABASE_URL et envoyer le résultat vers un stockage hors-site (S3, R2...) — un disque
 * local ne protège pas contre une panne du serveur lui-même.
 */
export function startBackupScheduler(): void {
  cron.schedule("0 3 * * *", () => {
    runDatabaseBackup()
      .then((result) => console.log(`[sauvegarde] ${result.file} (${result.sizeBytes} octets)`))
      .catch((error) => console.error("[sauvegarde] échec de la sauvegarde planifiée", error));
  });
}
