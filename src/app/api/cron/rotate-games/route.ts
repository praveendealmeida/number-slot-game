import { rotateGames } from "@/lib/rotate";
import { NextResponse } from "next/server";

// Invoked by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` — set CRON_SECRET as an env var in
// the Vercel project (Settings -> Environment Variables) to match.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await rotateGames();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Game rotation failed:", error);
    return NextResponse.json({ ok: false, error: "Rotation failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
