import { getCurrentUser } from "@/lib/auth";
import { getMyTickets } from "@/services/daily-game";

// GET /api/daily-game/tickets — get current user's tickets
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const tickets = await getMyTickets(user.id);

  return Response.json(
    tickets.map((t) => ({
      id: t.id,
      gameId: t.gameId,
      selectedNumber: t.selectedNumber,
      entryFee: t.entryFee,
      status: t.status,
      prizeCredited: t.prizeCredited,
      createdAt: t.createdAt.toISOString(),
      game: {
        title: t.game.title,
        prizeAmount: t.game.prizeAmount,
        winningNumber: t.game.winningNumber,
        processed: t.game.processed,
      },
    })),
    { status: 200 },
  );
}