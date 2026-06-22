import { prisma } from "@/lib/db";

export type GameFinanceRow = {
  gameId: string;
  title: string;
  ticketPrice: number;
  payoutPercent: number;
  status: string;
  soldCount: number;
  totalCollections: number;
  payoutAmount: number;
  platformRevenue: number;
  winningNumber: number | null;
};

export type FinanceOverview = {
  totals: {
    totalCollections: number;
    totalPayouts: number;
    platformNetRevenue: number;
    gamesDrawn: number;
    gamesOpen: number;
  };
  games: GameFinanceRow[];
};

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tickets: {
        where: { paymentStatus: "COMPLETED" },
        select: { pricePaid: true },
      },
    },
  });

  const rows: GameFinanceRow[] = games.map((game) => {
    const totalCollections = game.tickets.reduce(
      (sum, ticket) => sum + ticket.pricePaid,
      0,
    );
    const payoutAmount = game.payoutAmount ?? 0;
    const platformRevenue =
      game.status === "DRAWN" ? totalCollections - payoutAmount : totalCollections;

    return {
      gameId: game.id,
      title: game.title,
      ticketPrice: game.ticketPrice,
      payoutPercent: game.payoutPercent,
      status: game.status,
      soldCount: game.tickets.length,
      totalCollections,
      payoutAmount,
      platformRevenue,
      winningNumber: game.winningNumber,
    };
  });

  const drawnGames = rows.filter((row) => row.status === "DRAWN");

  return {
    totals: {
      totalCollections: rows.reduce((sum, row) => sum + row.totalCollections, 0),
      totalPayouts: drawnGames.reduce((sum, row) => sum + row.payoutAmount, 0),
      platformNetRevenue: drawnGames.reduce((sum, row) => sum + row.platformRevenue, 0),
      gamesDrawn: drawnGames.length,
      gamesOpen: rows.filter((row) => row.status === "OPEN").length,
    },
    games: rows,
  };
}
