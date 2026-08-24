/**
 * Crée le tout premier compte administrateur de la plateforme (ou un compte supplémentaire).
 * Il n'y a volontairement aucune auto-inscription pour ce rôle — seul quelqu'un ayant accès
 * au serveur peut en créer un.
 *
 * Usage: npx tsx scripts/create-platform-admin.ts <email> <mot-de-passe>
 */
import { prisma } from "../src/prisma";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-platform-admin.ts <email> <mot-de-passe>");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Le mot de passe doit faire au moins 10 caractères.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.platformAdmin.create({
    data: { email: email.toLowerCase(), passwordHash },
  });

  console.log(`Compte admin créé : ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
