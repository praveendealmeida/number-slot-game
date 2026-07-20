import { getCurrentUser } from "@/lib/auth";
import { getOrCreateTodayGame, enterGame } from "@/services/daily-game";

// GET /api/daily-game — get today's game status
export async function GET() {
  const game = await getOrCreateTodayGame();

  return Response.json({
    id: game.id,
    title: game.title,
    entryFee: game.entryFee,
    prizeAmount: game.prizeAmount,
    maxPlayers: game.maxPlayers,
    currentPlayers: game.currentPlayers,
    endTime: game.endTime.toISOString(),
    active: game.active,
    processed: game.processed,
    winningNumber: game.winningNumber,
  });
}

// POST /api/daily-game — enter today's game
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const selectedNumber =
    body && typeof body === "object" && "selectedNumber" in body &&
    typeof (body as { selectedNumber: unknown }).selectedNumber === "string"
      ? (body as { selectedNumber: string }).selectedNumber
      : null;

  if (!selectedNumber) {
    return Response.json({ error: "selectedNumber is required (00-99)." }, { status: 400 });
  }

  try {
    const game = await getOrCreateTodayGame();
    const result = await enterGame(user.id, game.id, selectedNumber);

    return Response.json({
      ticket: {
        id: result.ticket.id,
        selectedNumber: result.ticket.selectedNumber,
        entryFee: result.ticket.entryFee,
        status: result.ticket.status,
        createdAt: result.ticket.createdAt.toISOString(),
      },
      balance: result.balance,
    }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to enter game." },
      { status: 400 },
    );
  }
}