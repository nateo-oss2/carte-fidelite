import { prisma } from "../prisma";

export async function getCompanyDashboardStats(companyId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [customersCount, transactionsCount, transactionsToday, newCustomersToday, pointsAgg, recentTransactions] =
    await Promise.all([
      prisma.customer.count({ where: { companyId } }),
      prisma.transaction.count({ where: { companyId, status: "COMPLETED" } }),
      prisma.transaction.count({ where: { companyId, status: "COMPLETED", createdAt: { gte: startOfToday } } }),
      prisma.customer.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
      prisma.transaction.aggregate({
        where: { companyId, type: "PURCHASE", status: "COMPLETED" },
        _sum: { pointsDelta: true, amount: true },
      }),
      prisma.transaction.findMany({
        where: { companyId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { customer: { select: { firstName: true, lastName: true, loyaltyNumber: true } } },
      }),
    ]);

  return {
    customersCount,
    transactionsCount,
    transactionsToday,
    newCustomersToday,
    pointsDistributed: pointsAgg._sum.pointsDelta ?? 0,
    totalAmount: pointsAgg._sum.amount?.toString() ?? "0",
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      pointsDelta: tx.pointsDelta,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt,
      customerName: [tx.customer.firstName, tx.customer.lastName].filter(Boolean).join(" ") || tx.customer.loyaltyNumber,
    })),
  };
}
