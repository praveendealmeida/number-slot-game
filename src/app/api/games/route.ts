import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TOTAL_SLOTS } from "@/lib/slots";
import { NextResponse } from "next/server";
import { seedDailyTierGames } from "@/services/game-seeder";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  // Auto-seed 5 tier games if none exist (safety net for local dev)
  await seedDailyTierGames().catch(() => undefined);

  const games = await prisma.game.findMany({
    orderBy: [{ ticketPrice: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { tickets: true } },
    },
  });

  const enriched = games.map((game) => ({
    id: game.id,
    title: game.title,
    ticketPrice: game.ticketPrice,
    payoutPercent: game.payoutPercent,
    status: game.status,
    winningNumber: game.winningNumber,
    soldCount: game._count.tickets,
    remainingSlots: TOTAL_SLOTS - game._count.tickets,
    createdAt: game.createdAt,
  }));

  const byPrice = enriched.reduce<Record<number, typeof enriched>>((acc, game) => {
    if (!acc[game.ticketPrice]) {
      acc[game.ticketPrice] = [];
    }
    acc[game.ticketPrice].push(game);
    return acc;
  }, {});

  const priceTiers = Object.entries(byPrice)
    .map(([price, tierGames]) => ({
      ticketPrice: Number(price),
      games: tierGames,
    }))
    .sort((a, b) => a.ticketPrice - b.ticketPrice);

  return NextResponse.json({ games: enriched, priceTiers });
}

type CreateGameBody = {
  title?: string;
  ticketPrice?: number;
};

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) {
    return admin;
  }

  let body: CreateGameBody;
  try {
    body = (await request.json()) as CreateGameBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const ticketPrice = body.ticketPrice;
  if (!ticketPrice || !Number.isInteger(ticketPrice) || ticketPrice <= 0) {
    return jsonError("ticketPrice must be a positive integer.", 400);
  }

  const title = body.title?.trim() || `Rs. ${ticketPrice} Game`;

  // payoutPercent is a fixed platform policy (WINNER_PAYOUT_PERCENT), not
  // admin-configurable — any client-supplied value is ignored.
  const game = await prisma.game.create({
    data: { title, ticketPrice, payoutPercent: WINNER_PAYOUT_PERCENT },
    select: {
      id: true,
      title: true,
      ticketPrice: true,
      payoutPercent: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      ...game,
      soldCount: 0,
      remainingSlots: TOTAL_SLOTS,
    },
    { status: 201 },
  );
}
