import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { reservationCutoff } from "@/lib/checkout";
import { prisma } from "@/lib/db";
import {
  GATEWAY_MAX,
  PaymentError,
  createChain2PayPayment,
  lkrToCharge,
  providerMinimum,
} from "@/lib/payment";
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

function appBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
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
    // 1) Reserve the slots (PENDING) under a serializable lock — no network here.
    const reservation = await prisma.$transaction(
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

        const cutoff = reservationCutoff();

        // Release expired reservations on the requested slots so they can be reused.
        await tx.ticket.deleteMany({
          where: {
            gameId,
            paymentStatus: "PENDING",
            createdAt: { lt: cutoff },
            slotNumber: { in: slotNumbers },
          },
        });

        const activeWhere = {
          gameId,
          OR: [
            { paymentStatus: "COMPLETED" as const },
            { paymentStatus: "PENDING" as const, createdAt: { gte: cutoff } },
          ],
        };

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

        const amountLkr = game.ticketPrice * slotNumbers.length;
        const { amount, currency } = lkrToCharge(amountLkr);
        const min = providerMinimum();

        if (amount > GATEWAY_MAX) {
          throw new PurchaseError(
            `This order (${currency} ${amount.toFixed(2)}) exceeds the gateway maximum of ${currency} ${GATEWAY_MAX}.`,
            400,
          );
        }
        if (amount < min) {
          throw new PurchaseError(
            `Card payments need a minimum of about ${currency} ${min.toFixed(2)}. This order is only ${currency} ${amount.toFixed(2)} — please select more slots.`,
            400,
            { minCharge: min, currency, amount },
          );
        }

        await Promise.all(
          slotNumbers.map((slotNumber) =>
            tx.ticket.create({
              data: {
                gameId,
                userId: user.id,
                slotNumber,
                pricePaid: game.ticketPrice,
                paymentStatus: "PENDING",
                paymentRef: reservationId,
              },
              select: { id: true },
            }),
          ),
        );

        return { amountLkr, amount, currency };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    // 2) Create the hosted payment (network call, outside the DB transaction).
    let payment;
    try {
      payment = await createChain2PayPayment({
        amount: reservation.amount,
        currency: reservation.currency,
        callbackUrl: `${appBaseUrl()}/api/payments/chain2pay`,
        customerEmail: user.email || undefined,
        metadata: {
          gameId,
          userId: user.id,
          reservationId,
          slots: slotNumbers.join(","),
        },
      });
    } catch (error) {
      // Roll back the reservation so the slots aren't stuck.
      await prisma.ticket.deleteMany({
        where: { paymentRef: reservationId, paymentStatus: "PENDING" },
      });
      throw error;
    }

    // 3) Stamp the real gateway order id onto the reserved tickets.
    await prisma.ticket.updateMany({
      where: { paymentRef: reservationId },
      data: { paymentRef: payment.orderId },
    });

    return NextResponse.json(
      {
        checkoutUrl: payment.checkoutUrl,
        orderId: payment.orderId,
        amount: reservation.amount,
        currency: reservation.currency,
        amountLkr: reservation.amountLkr,
        slotNumbers,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PurchaseError) {
      return jsonError(error.message, error.status, error.extra);
    }
    if (error instanceof PaymentError) {
      return jsonError(error.message, error.status, error.extra);
    }
    if (isUniqueConstraintError(error)) {
      return jsonError(
        "One or more slots were just taken by another user. Please refresh and try again.",
        409,
      );
    }
    console.error("Ticket purchase failed:", error);
    return jsonError("Unable to start the ticket purchase.", 500);
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

  const cutoff = reservationCutoff();
  const tickets = await prisma.ticket.findMany({
    where: {
      gameId,
      OR: [
        { paymentStatus: "COMPLETED" },
        { paymentStatus: "PENDING", createdAt: { gte: cutoff } },
      ],
    },
    select: { slotNumber: true, userId: true, paymentStatus: true },
    orderBy: { slotNumber: "asc" },
  });

  const soldSlots = tickets.map((t) => ({
    slotNumber: t.slotNumber,
    userId: t.userId,
    pending: t.paymentStatus === "PENDING",
  }));
  const soldCount = soldSlots.length;

  return NextResponse.json({
    game,
    soldCount,
    remainingSlots: TOTAL_SLOTS - soldCount,
    soldSlots,
    slotRange: { min: MIN_SLOT, max: MAX_SLOT, total: TOTAL_SLOTS },
  });
}
