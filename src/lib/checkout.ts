import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getChain2PayPayment } from "@/lib/payment";
import { TOTAL_SLOTS } from "@/lib/slots";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

// How long a slot stays reserved (PENDING) while the buyer completes checkout.
// After this, the reservation is treated as free and can be released/re-sold.
export function reservationMinutes(): number {
  return Number(process.env.CHAIN2PAY_RESERVATION_MINUTES) || 20;
}

export function reservationCutoff(): Date {
  return new Date(Date.now() - reservationMinutes() * 60_000);
}

export type SettleResult = "paid" | "pending" | "expired" | "not_found";

// Confirms (or releases) an order. Safe to call repeatedly and from both the
// webhook and the client poll — the gateway API is the source of truth.
export async function settleOrder(
  orderId: string,
): Promise<{ result: SettleResult; gameId: string | null; slotNumbers: number[] }> {
  const tickets = await prisma.ticket.findMany({
    where: { paymentRef: orderId },
    select: { gameId: true, slotNumber: true, paymentStatus: true },
  });

  if (tickets.length === 0) {
    return { result: "not_found", gameId: null, slotNumbers: [] };
  }

  const gameId = tickets[0].gameId;
  const slotNumbers = tickets.map((t) => t.slotNumber).sort((a, b) => a - b);

  if (tickets.every((t) => t.paymentStatus === "COMPLETED")) {
    return { result: "paid", gameId, slotNumbers };
  }

  const payment = await getChain2PayPayment(orderId);
  if (!payment) {
    return { result: "pending", gameId, slotNumbers };
  }

  if (payment.status === "paid") {
    await prisma.$transaction(async (tx: Tx) => {
      await tx.ticket.updateMany({
        where: { paymentRef: orderId, paymentStatus: "PENDING" },
        data: { paymentStatus: "COMPLETED" },
      });

      const completed = await tx.ticket.count({
        where: { gameId, paymentStatus: "COMPLETED" },
      });

      if (completed >= TOTAL_SLOTS) {
        await tx.game.updateMany({
          where: { id: gameId, status: "OPEN" },
          data: { status: "CLOSED", closedAt: new Date() },
        });
      }
    });
    return { result: "paid", gameId, slotNumbers };
  }

  if (payment.status === "expired" || payment.status === "dispatch_failed") {
    // Release the held slots so others can buy them.
    await prisma.ticket.deleteMany({
      where: { paymentRef: orderId, paymentStatus: "PENDING" },
    });
    return { result: "expired", gameId, slotNumbers };
  }

  return { result: "pending", gameId, slotNumbers };
}
