import { getCurrentUser } from "@/lib/auth";
import { getWallet, getTransactionHistory } from "@/services/daily-game";

// GET /api/wallet — get balance + transaction history
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const wallet = await getWallet(user.id);
  const transactions = await getTransactionHistory(user.id, 20);

  return Response.json({
    balance: wallet.balance,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}