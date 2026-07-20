import { requireAdmin } from "@/lib/auth";
import { processDailyWinners } from "@/services/daily-game";
import { logAdminAction } from "@/services/wallet";

// POST /api/admin/process-daily-winners — process today's game winners
export async function POST() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  try {
    const result = await processDailyWinners();

    await logAdminAction(
      admin.id,
      "WINNERS_PROCESSED",
      `Processed daily winners: ${result.winners} winner(s) out of ${result.total} tickets. Winning number: #${result.winningNumber}`,
      undefined,
      { winners: result.winners, total: result.total, winningNumber: result.winningNumber },
    );

    return Response.json({
      success: true,
      total: result.total,
      winners: result.winners,
      winningNumber: result.winningNumber,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process winners." },
      { status: 400 },
    );
  }
}
