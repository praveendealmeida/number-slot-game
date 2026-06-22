import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const admin = await requireAdmin();
  if (admin instanceof Response) {
    return admin;
  }

  const { gameId } = await context.params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, status: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  if (game.status !== "OPEN") {
    return NextResponse.json({ error: "Only open games can be closed." }, { status: 409 });
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { status: "CLOSED", closedAt: new Date() },
    select: { id: true, status: true, closedAt: true },
  });

  return NextResponse.json(updated);
}
