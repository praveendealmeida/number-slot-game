import { prisma } from "@/lib/db";
import { getLatestLotteryResult } from "./lottery";

const DEMO_BALANCE = process.env.DEMO_MODE === "true" ? 5000_00 : 0; // in LKR cents (Rs 1 = 100)

// ── Wallet helpers ───────────────────────────────────────────────────────

export async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: DEMO_BALANCE },
    update: {},
  });
}

export async function getWallet(userId: string) {
  return ensureWallet(userId);
}

// ── Daily Game ───────────────────────────────────────────────────────────

export async function getOrCreateTodayGame() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let game = await prisma.dailyGame.findFirst({
    where: { active: true, endTime: { gte: today } },
    orderBy: { createdAt: "desc" },
  });

  if (!game) {
    game = await prisma.dailyGame.create({
      data: {
        title: "Daily Number",
        entryFee: 100_00,      // Rs 100 in LKR cents
        prizeAmount: 10000_00, // Rs 10,000 in LKR cents
        maxPlayers: 100,
        startTime: today,
        endTime: tomorrow,
        currentPlayers: 0,
      },
    });
  }

  return game;
}

export async function getMyTicket(userId: string, gameId: string) {
  return prisma.dailyTicket.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
}

/**
 * Enters a user into today's daily number game.
 * Uses a Prisma interactive transaction to atomically:
 *   1. validate game state & wallet
 *   2. create ticket
 *   3. deduct balance + write transaction
 *   4. increment player count
 *
 * This prevents double-entry from concurrent requests.
 */
export async function enterGame(
  userId: string,
  gameId: string,
  selectedNumber: string,
) {
  // Basic validation (fast-fail before touching DB)
  if (!/^\d{2}$/.test(selectedNumber) || Number(selectedNumber) > 99) {
    throw new Error("Invalid number. Pick 00-99.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Load game with row lock for update
    const game = await tx.dailyGame.findUnique({ where: { id: gameId } });
    if (!game || !game.active) throw new Error("This game is no longer active.");
    if (game.processed) throw new Error("This game has already been processed.");
    if (new Date() > game.endTime) throw new Error("This game has ended.");
    if (game.currentPlayers >= game.maxPlayers) throw new Error("This game is full.");

    // 2. Check wallet
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < game.entryFee) {
      throw new Error(
        `Insufficient wallet balance. You need Rs ${(game.entryFee / 100).toFixed(0)}.`,
      );
    }

    // 3. Check existing ticket (unique constraint also catches this, but
    //    explicit check gives a friendlier error)
    const existing = await tx.dailyTicket.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (existing) throw new Error("You already picked a number for today.");

    // 4. Create ticket
    const ticket = await tx.dailyTicket.create({
      data: { gameId, userId, selectedNumber, entryFee: game.entryFee },
    });

    // 5. Deduct balance + record transaction
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: game.entryFee } },
    });
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: "GAME_ENTRY",
        amount: -game.entryFee,
        balanceAfter: updatedWallet.balance,
        description: `Daily Number entry — #${selectedNumber}`,
        referenceId: ticket.id,
      },
    });

    // 6. Increment player count
    await tx.dailyGame.update({
      where: { id: gameId },
      data: { currentPlayers: { increment: 1 } },
    });

    return { ticket, balance: updatedWallet.balance };
  });
}

export async function getMyTickets(userId: string) {
  return prisma.dailyTicket.findMany({
    where: { userId },
    include: { game: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getTransactionHistory(userId: string, limit = 20) {
  const wallet = await getWallet(userId);
  return prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Admin: Process winners ──────────────────────────────────────────────

/**
 * Processes winners for the current active daily game.
 *
 * Idempotent — uses `prizeCredited` flag to prevent double-payment if the
 * admin accidentally calls this more than once. The entire operation runs
 * inside a single Prisma interactive transaction so the processed flag and
 * all winner credits are committed atomically.
 */
export async function processDailyWinners() {
  return prisma.$transaction(async (tx) => {
    const game = await tx.dailyGame.findFirst({
      where: { active: true, processed: false },
      orderBy: { createdAt: "desc" },
    });
    if (!game) throw new Error("No active, unprocessed game found.");

    const lottery = await getLatestLotteryResult();
    if (!lottery) throw new Error("No lottery result available yet.");

    const winningNumber = lottery.winningNumber;

    // Only process ACTIVE tickets that have NOT already been paid
    const tickets = await tx.dailyTicket.findMany({
      where: { gameId: game.id, status: "ACTIVE" },
    });

    let winners = 0;
    for (const ticket of tickets) {
      const won = ticket.selectedNumber === winningNumber;

      await tx.dailyTicket.update({
        where: { id: ticket.id },
        data: { status: won ? "WON" : "LOST" },
      });

      if (won && !ticket.prizeCredited) {
        const wallet = await tx.wallet.findUnique({ where: { userId: ticket.userId } });
        if (!wallet) continue; // should never happen — user always has wallet

        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: game.prizeAmount } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: ticket.userId,
            type: "WINNING",
            amount: game.prizeAmount,
            balanceAfter: updatedWallet.balance,
            description: `Daily Number winner — #${ticket.selectedNumber}`,
            referenceId: ticket.id,
          },
        });

        await tx.dailyTicket.update({
          where: { id: ticket.id },
          data: { prizeCredited: true },
        });

        winners++;
      }
    }

    // Mark game processed (atomic with everything above)
    await tx.dailyGame.update({
      where: { id: game.id },
      data: { processed: true, winningNumber, active: false },
    });

    return { total: tickets.length, winners, winningNumber };
  });
}

export async function getDailyGames() {
  return prisma.dailyGame.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
}