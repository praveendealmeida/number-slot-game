import { requireAdmin } from "@/lib/auth";
import { createLotteryResult } from "@/services/lottery";

// POST /api/admin/lottery-result — create a new lottery result (admin only)
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const drawNumber =
    body && typeof body === "object" && "drawNumber" in body &&
    typeof (body as { drawNumber: unknown }).drawNumber === "string"
      ? (body as { drawNumber: string }).drawNumber
      : null;

  const drawDate =
    body && typeof body === "object" && "drawDate" in body &&
    typeof (body as { drawDate: unknown }).drawDate === "string"
      ? (body as { drawDate: string }).drawDate
      : null;

  const ticketNumber =
    body && typeof body === "object" && "ticketNumber" in body &&
    typeof (body as { ticketNumber: unknown }).ticketNumber === "string"
      ? (body as { ticketNumber: string }).ticketNumber
      : null;

  if (!drawNumber || !drawDate || !ticketNumber) {
    return Response.json(
      { error: "drawNumber, drawDate, and ticketNumber are required." },
      { status: 400 },
    );
  }

  if (!/^\d+$/.test(ticketNumber) || ticketNumber.length < 2) {
    return Response.json(
      { error: "ticketNumber must be numeric with at least 2 digits." },
      { status: 400 },
    );
  }

  try {
    const result = await createLotteryResult({ drawNumber, drawDate, ticketNumber });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create result." },
      { status: 500 },
    );
  }
}