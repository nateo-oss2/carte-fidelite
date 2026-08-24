/**
 * Rattrapage ponctuel : au moment où lifetimePoints a été ajouté au schéma, les clients déjà
 * existants sont restés à 0 alors qu'ils avaient déjà des achats. Recalcule lifetimePoints à
 * partir de l'historique réel des transactions (PURCHASE + REFUND, jamais les REDEMPTION qui
 * ne doivent pas y toucher). À exécuter une seule fois après le déploiement de cette migration.
 *
 * Usage: npx tsx scripts/backfill-lifetime-points.ts
 */
import { prisma } from "../src/prisma";

async function main() {
  const customers = await prisma.customer.findMany({ select: { id: true } });
  let updated = 0;

  for (const customer of customers) {
    // Pas de filtre sur status : un achat passé à REVERSED a bien vu ses points appliqués au
    // moment de sa création (le REVERSED marque seulement qu'un remboursement a suivi, dont
    // le pointsDelta négatif est déjà compté séparément via son propre enregistrement REFUND).
    const agg = await prisma.transaction.aggregate({
      where: { customerId: customer.id, type: { in: ["PURCHASE", "REFUND"] } },
      _sum: { pointsDelta: true },
    });
    const lifetimePoints = Math.max(agg._sum.pointsDelta ?? 0, 0);

    await prisma.customer.update({ where: { id: customer.id }, data: { lifetimePoints } });
    updated++;
  }

  console.log(`lifetimePoints recalculé pour ${updated} client(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
