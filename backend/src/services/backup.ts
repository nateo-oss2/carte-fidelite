import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");
const RETENTION_COUNT = 14; // garde les 14 dernières sauvegardes (quotidiennes ~2 semaines)

/**
 * Sauvegarde la base via pg_dump, directement contre DATABASE_URL — fonctionne aussi bien en
 * local (Postgres dans Docker) qu'en production, tant que le binaire pg_dump est présent dans
 * l'environnement d'exécution.
 *
 * IMPORTANT en production (Railway ou autre hébergeur géré) : le disque du conteneur est
 * généralement éphémère — un fichier écrit ici ne survit pas à un redéploiement. Cette
 * fonction reste utile pour un export ponctuel à la demande, mais pour une vraie continuité
 * de sauvegarde, préférez la sauvegarde automatique native de votre fournisseur Postgres
 * (Railway propose ça nativement dans les réglages du service Postgres) — bien plus fiable
 * qu'un fichier local.
 */
export async function runDatabaseBackup(): Promise<{ file: string; sizeBytes: number }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);

  await execAsync(`pg_dump "${databaseUrl}" | gzip > "${filePath}"`);

  const stats = await stat(filePath);
  await pruneOldBackups();

  return { file: filename, sizeBytes: stats.size };
}

async function pruneOldBackups(): Promise<void> {
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("backup-")).sort();
  const excess = files.length - RETENTION_COUNT;
  if (excess <= 0) return;

  for (const file of files.slice(0, excess)) {
    await unlink(path.join(BACKUP_DIR, file)).catch(() => {});
  }
}

export async function listBackups(): Promise<Array<{ file: string; sizeBytes: number; createdAt: Date }>> {
  await mkdir(BACKUP_DIR, { recursive: true });
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("backup-"));

  const withStats = await Promise.all(
    files.map(async (file) => {
      const stats = await stat(path.join(BACKUP_DIR, file));
      return { file, sizeBytes: stats.size, createdAt: stats.mtime };
    }),
  );

  return withStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
