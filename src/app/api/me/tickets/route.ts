import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatSlotNumber } from "@/lib/slots";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const tickets = await prisma.ticket.findMany({
    where: { userId, paymentStatus: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          ticketPrice: true,
          status: true,
          winningNumber: true,
          payoutAmount: true,
          drawnAt: true,
        },
      },
    },
  });

  const history = tickets.map((ticket) => ({
    id: ticket.id,
    slotNumber: ticket.slotNumber,
    slotLabel: formatSlotNumber(ticket.slotNumber),
    pricePaid: ticket.pricePaid,
    outcome: ticket.outcome,
    purchasedAt: ticket.createdAt,
    game: ticket.game,
    isWinner: ticket.outcome === "WON",
    winAmount: ticket.outcome === "WON" ? ticket.game.payoutAmount : 0,
  }));

  const summary = {
    totalTickets: history.length,
    totalSpent: history.reduce((sum, row) => sum + row.pricePaid, 0),
    wins: history.filter((row) => row.outcome === "WON").length,
    losses: history.filter((row) => row.outcome === "LOST").length,
    pending: history.filter((row) => row.outcome === "PENDING").length,
    totalWinnings: history
      .filter((row) => row.outcome === "WON")
      .reduce((sum, row) => sum + (row.winAmount ?? 0), 0),
  };

  return NextResponse.json({ summary, tickets: history });
}
