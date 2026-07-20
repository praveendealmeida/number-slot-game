import { getLatestLotteryResult } from "@/services/lottery";

// ---------------------------------------------------------------------------
// GET /api/lottery/latest
//
// Returns the most recently created Mahajana Sampatha lottery result.
// Public endpoint — no authentication required.
// ---------------------------------------------------------------------------
export async function GET() {
  const result = await getLatestLotteryResult();

  if (!result) {
    return Response.json({ result: null }, { status: 200 });
  }

  return Response.json(
    {
      drawNumber: result.drawNumber,
      drawDate: result.drawDate,
      ticketNumber: result.ticketNumber,
      winningNumber: result.winningNumber,
    },
    { status: 200 },
  );
}