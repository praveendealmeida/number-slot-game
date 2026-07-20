import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/services/wallet";

// GET /api/admin/daily-games — list all daily games (admin only)
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const games = await prisma.dailyGame.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { tickets: { select: { id: true } } },
  });

  return Response.json(
    games.map((g) => ({
      id: g.id,
      title: g.title,
      entryFee: g.entryFee,
      prizeAmount: g.prizeAmount,
      maxPlayers: g.maxPlayers,
      currentPlayers: g.currentPlayers,
      ticketCount: g.tickets.length,
      startTime: g.startTime.toISOString(),
      endTime: g.endTime.toISOString(),
      active: g.active,
      processed: g.processed,
      winningNumber: g.winningNumber,
      revenue: g.tickets.length * g.entryFee,
      createdAt: g.createdAt.toISOString(),
    })),
  );
}

// POST /api/admin/daily-games — create new daily game
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const startTime = new Date(b.startTime as string || Date.now());
  const endTime = new Date(b.endTime as string || Date.now() + 86400000);

  const game = await prisma.dailyGame.create({
    data: {
      title: (b.title as string) || "Daily Number",
      entryFee: Number(b.entryFee) || 10000,
      prizeAmount: Number(b.prizeAmount) || 1000000,
      maxPlayers: Number(b.maxPlayers) || 100,
      active: b.active !== false,
      startTime,
      endTime,
    },
  });

  await logAdminAction(admin.id, "GAME_CREATED", `Created game "${game.title}"`, undefined, { gameId: game.id });

  return Response.json(game, { status: 201 });
}