import { prisma } from "@/lib/db";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";

const TIER_PRICES = [50, 100, 200, 500, 1000];

/**
 * Seeds one game per price tier if no OPEN game exists at that tier.
 * Games run from noon to 7 PM daily.
 * Called by the 12 PM cron (Vercel) and as a safety net on first API access.
 */
export async function seedDailyTierGames() {
  const now = new Date();
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const sevenPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);

  // If current time is past noon, start games immediately; otherwise set the start to noon
  const startTime = now >= noon ? now : noon;
  const endTime = sevenPM;

  let created = 0;

  for (const price of TIER_PRICES) {
    const existing = await prisma.game.findFirst({
      where: { ticketPrice: price, status: "OPEN" },
    });

    if (!existing) {
      await prisma.game.create({
        data: {
          title: `Lucky Number 00-99 (Rs ${price})`,
          ticketPrice: price,
          payoutPercent: WINNER_PAYOUT_PERCENT,
          status: "OPEN",
        },
      });
      created++;
    }
  }

  return { created, startTime: startTime.toISOString(), endTime: endTime.toISOString(), tiers: TIER_PRICES };
}