import { getCurrentUserId } from "@/lib/auth";
import { settleOrder } from "@/lib/checkout";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Polled by the buyer after they open checkout. Also reconciles against the
// gateway, so a payment confirms here even if the webhook was missed/delayed.
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing ref." }, { status: 400 });
  }

  const owned = await prisma.ticket.findFirst({
    where: { paymentRef: ref, userId },
    select: { id: true },
  });
  if (!owned) {
    // Either never existed, or the reservation expired and was released.
    return NextResponse.json({ status: "expired", gameId: null, slotNumbers: [] });
  }

  const { result, gameId, slotNumbers } = await settleOrder(ref);
  return NextResponse.json({ status: result, gameId, slotNumbers });
}
