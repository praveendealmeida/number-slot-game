import { PrismaClient } from "@/generated/prisma/client";
import { parseSlotNumber } from "@/lib/slots";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type DrawResult = {
  gameId: string;
  winningNumber: number;
  hasWinner: boolean;
  winnerUserId: string | null;
  totalCollections: number;
  payoutAmount: number;
  platformRevenue: number;
};

export async function executeGameDraw(
  tx: TransactionClient,
  gameId: string,
  winningNumberInput: unknown,
): Promise<DrawResult> {
  const winningNumber = parseSlotNumber(winningNumberInput);
  if (winningNumber === null) {
    throw new DrawError("Winning number must be between 00 and 99.", 400);
  }

  const lockedGames = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM games WHERE id = ${gameId} FOR UPDATE
  `;

  if (lockedGames.length === 0) {
    throw new DrawError("Game not found.", 404);
  }

  const game = await tx.game.findUniqueOrThrow({
    where: { id: gameId },
    select: { id: true, status: true, winningNumber: true, payoutPercent: true },
  });

  if (game.status === "DRAWN") {
    throw new DrawError("This game has already been drawn.", 409);
  }

  if (game.status !== "CLOSED") {
    throw new DrawError("Only closed games can be drawn.", 409);
  }

  const tickets = await tx.ticket.findMany({
    where: { gameId, paymentStatus: "COMPLETED" },
    select: { id: true, userId: true, slotNumber: true, pricePaid: true },
  });

  const totalCollections = tickets.reduce((sum, ticket) => sum + ticket.pricePaid, 0);
  const winningTicket = tickets.find((ticket) => ticket.slotNumber === winningNumber);
  // Winner receives the configured percentage of the pool; the platform keeps
  // the remainder (and the whole pool when nobody holds the winning number).
  const payoutAmount = winningTicket
    ? Math.floor((totalCollections * game.payoutPercent) / 100)
    : 0;
  const platformRevenue = totalCollections - payoutAmount;

  await tx.game.update({
    where: { id: gameId },
    data: {
      status: "DRAWN",
      winningNumber,
      payoutAmount,
      drawnAt: new Date(),
    },
  });

  if (tickets.length > 0) {
    await tx.ticket.updateMany({
      where: { gameId },
      data: { outcome: "LOST" },
    });

    if (winningTicket) {
      await tx.ticket.update({
        where: { id: winningTicket.id },
        data: { outcome: "WON" },
      });
    }
  }

  return {
    gameId,
    winningNumber,
    hasWinner: Boolean(winningTicket),
    winnerUserId: winningTicket?.userId ?? null,
    totalCollections,
    payoutAmount,
    platformRevenue,
  };
}

export class DrawError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DrawError";
  }
}
