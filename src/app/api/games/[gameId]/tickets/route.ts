import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processPaymentPlaceholder } from "@/lib/payment";
import {
  MAX_SLOT,
  MIN_SLOT,
  TOTAL_SLOTS,
  normalizeSlotNumbers,
} from "@/lib/slots";
import { NextResponse } from "next/server";

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
  const userId = await getCurrentUserId();
  if (!userId) {
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

  try {
    const result = await prisma.$transaction(
      async (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => {
        // Row-level lock on the game prevents race conditions during checkout.
        const lockedGames = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM games
          WHERE id = ${gameId}
          FOR UPDATE
        `;

        if (lockedGames.length === 0) {
          throw new PurchaseError("Game not found.", 404);
        }

        const game = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: {
            id: true,
            status: true,
            ticketPrice: true,
          },
        });

        if (game.status !== "OPEN") {
          throw new PurchaseError("This game is not open for ticket purchases.", 409);
        }

        const soldCount = await tx.ticket.count({ where: { gameId } });
        const remainingBeforePurchase = TOTAL_SLOTS - soldCount;

        if (slotNumbers.length > remainingBeforePurchase) {
          throw new PurchaseError(
            `Only ${remainingBeforePurchase} slot(s) remain in this game.`,
            409,
            { remainingSlots: remainingBeforePurchase },
          );
        }

        const existingTickets = await tx.ticket.findMany({
          where: {
            gameId,
            slotNumber: { in: slotNumbers },
          },
          select: { slotNumber: true },
        });

        if (existingTickets.length > 0) {
          throw new PurchaseError("One or more selected slots are already sold.", 409, {
            unavailableSlots: existingTickets.map(
              (ticket: { slotNumber: number }) => ticket.slotNumber,
            ),
          });
        }

        const totalAmount = game.ticketPrice * slotNumbers.length;
        const payment = await processPaymentPlaceholder({
          userId,
          gameId,
          amount: totalAmount,
          slotNumbers,
        });

        if (!payment.success) {
          throw new PurchaseError(payment.error ?? "Payment failed.", 402);
        }

        const createdTickets = await Promise.all(
          slotNumbers.map((slotNumber) =>
            tx.ticket.create({
              data: {
                gameId,
                userId,
                slotNumber,
                pricePaid: game.ticketPrice,
                paymentStatus: "COMPLETED",
                paymentRef: payment.reference,
              },
              select: {
                id: true,
                slotNumber: true,
                pricePaid: true,
                paymentRef: true,
                createdAt: true,
              },
            }),
          ),
        );

        const newSoldCount = soldCount + createdTickets.length;
        const remainingSlots = TOTAL_SLOTS - newSoldCount;

        if (newSoldCount >= TOTAL_SLOTS) {
          await tx.game.update({
            where: { id: gameId },
            data: {
              status: "CLOSED",
              closedAt: new Date(),
            },
          });
        }

        return {
          tickets: createdTickets,
          soldCount: newSoldCount,
          remainingSlots,
          totalPaid: totalAmount,
          paymentReference: payment.reference,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PurchaseError) {
      return jsonError(error.message, error.status, error.extra);
    }

    if (isUniqueConstraintError(error)) {
      return jsonError(
        "One or more slots were just purchased by another user. Please refresh and try again.",
        409,
      );
    }

    console.error("Ticket purchase failed:", error);
    return jsonError("Unable to complete ticket purchase.", 500);
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
    where: { gameId },
    select: {
      slotNumber: true,
      userId: true,
      createdAt: true,
    },
    orderBy: { slotNumber: "asc" },
  });

  const soldCount = tickets.length;

  return NextResponse.json({
    game,
    soldCount,
    remainingSlots: TOTAL_SLOTS - soldCount,
    soldSlots: tickets,
    slotRange: { min: MIN_SLOT, max: MAX_SLOT, total: TOTAL_SLOTS },
  });
}
