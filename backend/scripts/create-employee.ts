/**
 * Crée un employé (compte de connexion) pour une entreprise existante — typiquement le tout
 * premier compte ADMIN d'une entreprise, à remettre au client une fois le contrat signé.
 * Une vraie gestion des employés depuis le dashboard entreprise viendra plus tard (Phase 18).
 *
 * Usage: npx tsx scripts/create-employee.ts <company-slug> <nom> <email> <mot-de-passe> [ADMIN|MANAGER|EMPLOYEE]
 */
import { prisma } from "../src/prisma";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const [slug, name, email, password, role = "ADMIN"] = process.argv.slice(2);
  if (!slug || !name || !email || !password) {
    console.error("Usage: npx tsx scripts/create-employee.ts <company-slug> <nom> <email> <mot-de-passe> [ADMIN|MANAGER|EMPLOYEE]");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Le mot de passe doit faire au moins 10 caractères.");
    process.exit(1);
  }
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
    console.error("Rôle invalide : ADMIN, MANAGER ou EMPLOYEE.");
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    console.error(`Aucune entreprise avec le slug "${slug}"`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role as "ADMIN" | "MANAGER" | "EMPLOYEE",
    },
  });

  console.log(`Employé créé : ${employee.email} (${employee.role}) pour ${company.name}`);
  console.log(`Connexion : /company/${company.slug}/login`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
