import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/admin/stats — dashboard metrics (admin only)
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    verifiedUsers,
    todayUsers,
    todayEntries,
    activeGames,
    totalPayouts,
    todayRevenue,
    totalBalance,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { phoneVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.dailyTicket.count({ where: { createdAt: { gte: today } } }),
    prisma.dailyGame.count({ where: { active: true } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: "WINNING" } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: "GAME_ENTRY", createdAt: { gte: today } } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
  ]);

  return Response.json({
    totalUsers,
    verifiedUsers,
    todayRegistrations: todayUsers,
    todayEntries,
    activeGames,
    totalPayouts: Math.abs(totalPayouts._sum.amount ?? 0),
    todayRevenue: Math.abs(todayRevenue._sum.amount ?? 0),
    totalBalance: totalBalance._sum.balance ?? 0,
  });
}