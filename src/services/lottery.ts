import { prisma } from "@/lib/db";

/**
 * Computes the winning number from a Mahajana Sampatha ticket number.
 * The last 2 digits of the ticket become the winning number (00-99).
 *
 * Example: ticket "123456" → winning "56"
 */
export function computeWinningNumber(ticketNumber: string): string {
  const digits = ticketNumber.replace(/\D/g, "");
  if (digits.length < 2) {
    throw new Error("Ticket number must have at least 2 digits.");
  }
  return digits.slice(-2).padStart(2, "0");
}

export type LotteryData = {
  id: string;
  drawNumber: string;
  drawDate: string;
  ticketNumber: string;
  winningNumber: string;
};

export async function getLatestLotteryResult(): Promise<LotteryData | null> {
  const result = await prisma.lotteryResult.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!result) return null;

  return {
    id: result.id,
    drawNumber: result.drawNumber,
    drawDate: result.drawDate.toISOString(),
    ticketNumber: result.ticketNumber,
    winningNumber: result.winningNumber,
  };
}

export async function createLotteryResult(data: {
  drawNumber: string;
  drawDate: string;
  ticketNumber: string;
}): Promise<LotteryData> {
  const winningNumber = computeWinningNumber(data.ticketNumber);

  const result = await prisma.lotteryResult.create({
    data: {
      drawNumber: data.drawNumber,
      drawDate: new Date(data.drawDate),
      ticketNumber: data.ticketNumber,
      winningNumber,
    },
  });

  return {
    id: result.id,
    drawNumber: result.drawNumber,
    drawDate: result.drawDate.toISOString(),
    ticketNumber: result.ticketNumber,
    winningNumber: result.winningNumber,
  };
}

export async function updateLotteryResult(
  id: string,
  data: { drawNumber?: string; drawDate?: string; ticketNumber?: string },
): Promise<LotteryData | null> {
  const existing = await prisma.lotteryResult.findUnique({ where: { id } });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.drawNumber) updateData.drawNumber = data.drawNumber;
  if (data.drawDate) updateData.drawDate = new Date(data.drawDate);
  if (data.ticketNumber) {
    updateData.ticketNumber = data.ticketNumber;
    updateData.winningNumber = computeWinningNumber(data.ticketNumber);
  }

  const result = await prisma.lotteryResult.update({
    where: { id },
    data: updateData,
  });

  return {
    id: result.id,
    drawNumber: result.drawNumber,
    drawDate: result.drawDate.toISOString(),
    ticketNumber: result.ticketNumber,
    winningNumber: result.winningNumber,
  };
}

export async function deleteLotteryResult(id: string): Promise<boolean> {
  try {
    await prisma.lotteryResult.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}