import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { DrawResult, executeGameDraw } from "@/lib/draw";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TICKET_PRICE_TIERS } from "@/lib/pricing";

// A game that's been open this long gets auto-closed and auto-drawn, even if
// it never sold out. This is what makes games "disappear" from the lobby daily.
const GAME_LIFETIME_HOURS = 24;

export type RotationSummary = {
  autoDrawn: DrawResult[];
  tiersReplenished: Array<{ ticketPrice: number; gameId: string; title: string }>;
};

// Auto-close every OPEN game older than GAME_LIFETIME_HOURS, then immediately
// draw it with a fair, cryptographically random winning number (00-99). Games
// that closed early by selling out are untouched here — those still wait for
// an admin's manual draw, same as before.
async function autoCloseAndDrawExpiredGames(): Promise<DrawResult[]> {
  const cutoff = new Date(Date.now() - GAME_LIFETIME_HOURS * 60 * 60 * 1000);

  const expired = await prisma.game.findMany({
    where: { status: "OPEN", createdAt: { lte: cutoff } },
    select: { id: true },
  });

  const results: DrawResult[] = [];

  for (const { id: gameId } of expired) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const closed = await tx.game.updateMany({
          where: { id: gameId, status: "OPEN" },
          data: { status: "CLOSED", closedAt: new Date() },
        });
        // Someone else (e.g. a concurrent request) may have already moved
        // this game on — skip it rather than error.
        if (closed.count === 0) {
          return null;
        }
        const winningNumber = randomInt(0, 100); // fair, cryptographically random 00-99
        return executeGameDraw(tx, gameId, winningNumber);
      });
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Auto-draw failed for game ${gameId}:`, error);
    }
  }

  return results;
}

// Make sure each of the 5 fixed price tiers always has at least one OPEN game
// for players to buy into. Runs after the auto-draw step above, so a tier that
// just got drawn is immediately replenished with a fresh game.
async function ensureOpenTierGames(): Promise<
  Array<{ ticketPrice: number; gameId: string; title: string }>
> {
  const created: Array<{ ticketPrice: number; gameId: string; title: string }> = [];

  for (const ticketPrice of TICKET_PRICE_TIERS) {
    const openCount = await prisma.game.count({
      where: { status: "OPEN", ticketPrice },
    });
    if (openCount > 0) {
      continue;
    }

    const title = `Rs. ${ticketPrice} Game`;
    const game = await prisma.game.create({
      data: { title, ticketPrice, payoutPercent: WINNER_PAYOUT_PERCENT },
      select: { id: true },
    });
    created.push({ ticketPrice, gameId: game.id, title });
  }

  return created;
}

export async function rotateGames(): Promise<RotationSummary> {
  const autoDrawn = await autoCloseAndDrawExpiredGames();
  const tiersReplenished = await ensureOpenTierGames();
  return { autoDrawn, tiersReplenished };
}
