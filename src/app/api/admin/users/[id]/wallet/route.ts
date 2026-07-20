import { requireAdmin } from "@/lib/auth";
import { adminAdjustWallet } from "@/services/wallet";

// POST /api/admin/users/:id/wallet — adjust user wallet (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id: targetUserId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount =
    body && typeof body === "object" && "amount" in body &&
    typeof (body as { amount: unknown }).amount === "number"
      ? (body as { amount: number }).amount
      : null;

  const reason =
    body && typeof body === "object" && "reason" in body &&
    typeof (body as { reason: unknown }).reason === "string"
      ? (body as { reason: string }).reason
      : null;

  if (amount === null || amount === 0 || !reason) {
    return Response.json(
      { error: "amount (non-zero integer in LKR cents) and reason are required." },
      { status: 400 },
    );
  }

  try {
    const wallet = await adminAdjustWallet(admin.id, targetUserId, amount, reason);
    return Response.json({ balance: wallet.balance }, { status: 200 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Wallet adjustment failed." },
      { status: 400 },
    );
  }
}