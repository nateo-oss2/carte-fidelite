import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");
const RETENTION_COUNT = 14; // garde les 14 dernières sauvegardes (quotidiennes ~2 semaines)

/**
 * Sauvegarde la base via pg_dump (exécuté dans le conteneur Postgres local — voir le
 * commentaire dans scripts/backup-database.ts pour l'équivalent en vraie production).
 */
export async function runDatabaseBackup(): Promise<{ file: string; sizeBytes: number }> {
  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);
  const containerName = process.env.BACKUP_POSTGRES_CONTAINER || "loyalty-postgres";
  const dbUser = process.env.BACKUP_POSTGRES_USER || "loyalty";
  const dbName = process.env.BACKUP_POSTGRES_DB || "loyalty_platform";

  await execAsync(
    `docker exec ${containerName} pg_dump -U ${dbUser} ${dbName} | gzip > "${filePath}"`,
  );

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
