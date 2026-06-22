import { requireAdmin } from "@/lib/auth";
import { DrawError, executeGameDraw } from "@/lib/draw";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type DrawBody = {
  winningNumber?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const admin = await requireAdmin();
  if (admin instanceof Response) {
    return admin;
  }

  const { gameId } = await context.params;

  let body: DrawBody;
  try {
    body = (await request.json()) as DrawBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      executeGameDraw(tx, gameId, body.winningNumber),
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DrawError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Draw failed:", error);
    return NextResponse.json({ error: "Unable to complete draw." }, { status: 500 });
  }
}
