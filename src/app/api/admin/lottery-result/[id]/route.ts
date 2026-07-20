import { requireAdmin } from "@/lib/auth";
import { updateLotteryResult, deleteLotteryResult } from "@/services/lottery";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/lottery-result/:id — update a lottery result (admin only)
export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;

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
      : undefined;

  const drawDate =
    body && typeof body === "object" && "drawDate" in body &&
    typeof (body as { drawDate: unknown }).drawDate === "string"
      ? (body as { drawDate: string }).drawDate
      : undefined;

  const ticketNumber =
    body && typeof body === "object" && "ticketNumber" in body &&
    typeof (body as { ticketNumber: unknown }).ticketNumber === "string"
      ? (body as { ticketNumber: string }).ticketNumber
      : undefined;

  if (ticketNumber && (!/^\d+$/.test(ticketNumber) || ticketNumber.length < 2)) {
    return Response.json(
      { error: "ticketNumber must be numeric with at least 2 digits." },
      { status: 400 },
    );
  }

  const result = await updateLotteryResult(id, { drawNumber, drawDate, ticketNumber });
  if (!result) {
    return Response.json({ error: "Lottery result not found." }, { status: 404 });
  }

  return Response.json(result, { status: 200 });
}

// DELETE /api/admin/lottery-result/:id — delete a lottery result (admin only)
export async function DELETE(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  const deleted = await deleteLotteryResult(id);

  if (!deleted) {
    return Response.json({ error: "Lottery result not found." }, { status: 404 });
  }

  return Response.json({ success: true }, { status: 200 });
}