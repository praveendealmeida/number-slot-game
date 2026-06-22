import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TOTAL_SLOTS } from "@/lib/slots";
import { NextResponse } from "next/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
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
  payoutPercent?: number;
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

  const payoutPercent = body.payoutPercent ?? 80;
  if (
    !Number.isInteger(payoutPercent) ||
    payoutPercent < 1 ||
    payoutPercent > 100
  ) {
    return jsonError("payoutPercent must be an integer between 1 and 100.", 400);
  }

  const title = body.title?.trim() || `Rs. ${ticketPrice} Game`;

  const game = await prisma.game.create({
    data: { title, ticketPrice, payoutPercent },
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
