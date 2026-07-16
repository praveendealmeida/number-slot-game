import { prisma } from "@/lib/db";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { NextResponse } from "next/server";

// Dev-only helper to spin up sample games quickly. Users now come from Google
// sign-in, so this no longer creates users.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  await prisma.ticket.deleteMany();
  await prisma.game.deleteMany();

  await prisma.game.createMany({
    data: [
      { title: "Rs. 100 Game", ticketPrice: 100, payoutPercent: WINNER_PAYOUT_PERCENT },
      { title: "Rs. 500 Game", ticketPrice: 500, payoutPercent: WINNER_PAYOUT_PERCENT },
      { title: "Rs. 1000 Game", ticketPrice: 1000, payoutPercent: WINNER_PAYOUT_PERCENT },
    ],
  });

  const games = await prisma.game.findMany({ orderBy: { ticketPrice: "asc" } });
  return NextResponse.json({ games });
}
