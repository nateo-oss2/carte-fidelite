/**
 * Remet la plateforme à zéro côté entreprises : supprime toutes les entreprises et tout ce
 * qui en dépend (clients, transactions, employés, terminaux, récompenses, paliers...).
 * Préserve les comptes admin plateforme et détache (sans les supprimer) les logs d'audit /
 * alertes de sécurité déjà enregistrés, pour ne pas perdre cet historique-là.
 *
 * Usage: npx tsx scripts/reset-all-companies.ts
 */
import { prisma } from "../src/prisma";

async function main() {
  await prisma.customerNotification.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.walletPass.deleteMany({});
  await prisma.customerToken.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.reward.deleteMany({});
  await prisma.discountTier.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.terminal.deleteMany({});
  await prisma.companyEmailConfig.deleteMany({});
  await prisma.auditLog.updateMany({ data: { companyId: null } });
  await prisma.securityAlert.updateMany({ data: { companyId: null } });
  const result = await prisma.company.deleteMany({});

  console.log(`${result.count} entreprise(s) supprimée(s), toutes les données associées nettoyées.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
