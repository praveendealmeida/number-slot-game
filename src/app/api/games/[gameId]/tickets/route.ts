import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_SLOT,
  MIN_SLOT,
  TOTAL_SLOTS,
  normalizeSlotNumbers,
} from "@/lib/slots";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type PurchaseBody = {
  slotNumbers?: unknown;
};

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  const { gameId } = await context.params;

  let body: PurchaseBody;
  try {
    body = (await request.json()) as PurchaseBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const slotNumbers = normalizeSlotNumbers(body.slotNumbers);
  if (!slotNumbers) {
    return jsonError(
      "Provide slotNumbers as a non-empty array of integers from 0 to 99.",
      400,
    );
  }

  const reservationId = randomUUID();

  try {
    // Demo payment sandbox: no external gateway. Slot reservation, wallet
    // debit, and ticket creation all happen atomically in one transaction —
    // a purchase either fully succeeds (tickets COMPLETED) or fully fails,
    // no PENDING/held state and nothing to reconcile asynchronously.
    const result = await prisma.$transaction(
      async (tx: Tx) => {
        const lockedGames = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM games WHERE id = ${gameId} FOR UPDATE
        `;
        if (lockedGames.length === 0) {
          throw new PurchaseError("Game not found.", 404);
        }

        const game = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: { id: true, status: true, ticketPrice: true },
        });

        if (game.status !== "OPEN") {
          throw new PurchaseError("This game is not open for ticket purchases.", 409);
        }

        const activeWhere = { gameId, paymentStatus: "COMPLETED" as const };

        const activeCount = await tx.ticket.count({ where: activeWhere });
        const remaining = TOTAL_SLOTS - activeCount;
        if (slotNumbers.length > remaining) {
          throw new PurchaseError(`Only ${remaining} slot(s) remain in this game.`, 409, {
            remainingSlots: remaining,
          });
        }

        const taken = await tx.ticket.findMany({
          where: { ...activeWhere, slotNumber: { in: slotNumbers } },
          select: { slotNumber: true },
        });
        if (taken.length > 0) {
          throw new PurchaseError("One or more selected slots are already taken.", 409, {
            unavailableSlots: taken.map((t: { slotNumber: number }) => t.slotNumber),
          });
        }

        // ticketPrice is in whole Rupees; wallet balance/transactions are in
        // LKR cents (Rs 1 = 100), matching the daily-game wallet convention.
        const amountLkr = game.ticketPrice * slotNumbers.length;
        const amountCents = amountLkr * 100;

        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet || wallet.balance < amountCents) {
          throw new PurchaseError(
            `Insufficient wallet balance. You need Rs ${amountLkr.toLocaleString("en-IN")}.`,
            402,
            { balance: wallet?.balance ?? 0, required: amountCents },
          );
        }

        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amountCents } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: user.id,
            type: "TICKET_PURCHASE",
            amount: -amountCents,
            balanceAfter: updatedWallet.balance,
            description: `${slotNumbers.length} slot(s) — game ${gameId}`,
            referenceId: reservationId,
          },
        });

        await Promise.all(
          slotNumbers.map((slotNumber) =>
            tx.ticket.create({
              data: {
                gameId,
                userId: user.id,
                slotNumber,
                pricePaid: game.ticketPrice,
                paymentStatus: "COMPLETED",
                paymentRef: reservationId,
              },
              select: { id: true },
            }),
          ),
        );

        const completed = activeCount + slotNumbers.length;
        if (completed >= TOTAL_SLOTS) {
          await tx.game.updateMany({
            where: { id: gameId, status: "OPEN" },
            data: { status: "CLOSED", closedAt: new Date() },
          });
        }

        return { amountLkr, balance: updatedWallet.balance };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    return NextResponse.json(
      {
        success: true,
        slotNumbers,
        amountLkr: result.amountLkr,
        balance: result.balance,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PurchaseError) {
      return jsonError(error.message, error.status, error.extra);
    }
    if (isUniqueConstraintError(error)) {
      return jsonError(
        "One or more slots were just taken by another user. Please refresh and try again.",
        409,
      );
    }
    console.error("Ticket purchase failed:", error);
    return jsonError("Unable to complete the ticket purchase.", 500);
  }
}

class PurchaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      title: true,
      ticketPrice: true,
      payoutPercent: true,
      status: true,
      winningNumber: true,
    },
  });

  if (!game) {
    return jsonError("Game not found.", 404);
  }

  const tickets = await prisma.ticket.findMany({
    where: { gameId, paymentStatus: "COMPLETED" },
    select: { slotNumber: true, userId: true },
    orderBy: { slotNumber: "asc" },
  });

  const soldSlots = tickets.map((t) => ({ slotNumber: t.slotNumber, userId: t.userId }));
  const soldCount = soldSlots.length;

  return NextResponse.json({
    game,
    soldCount,
    remainingSlots: TOTAL_SLOTS - soldCount,
    soldSlots,
    slotRange: { min: MIN_SLOT, max: MAX_SLOT, total: TOTAL_SLOTS },
  });
}
