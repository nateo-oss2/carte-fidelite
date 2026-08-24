/**
 * Utilitaire de développement : crée un terminal autorisé pour une entreprise et affiche
 * sa clé API en clair (une seule fois — seul son hash est stocké en base).
 * Remplacé plus tard par un écran du dashboard entreprise (Phase 8).
 *
 * Usage: npx tsx scripts/create-terminal.ts <company-slug> <label>
 */
import { prisma } from "../src/prisma";
import { createTerminal } from "../src/services/terminalAuth";

async function main() {
  const [slug, label] = process.argv.slice(2);
  if (!slug || !label) {
    console.error("Usage: npx tsx scripts/create-terminal.ts <company-slug> <label>");
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    console.error(`Aucune entreprise avec le slug "${slug}"`);
    process.exit(1);
  }

  const { terminal, rawApiKey } = await createTerminal(company.id, label);
  console.log(JSON.stringify({ terminalId: terminal.id, label: terminal.label, apiKey: rawApiKey }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
