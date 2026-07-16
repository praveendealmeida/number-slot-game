import { requireAdmin } from "@/lib/auth";
import { rotateGames } from "@/lib/rotate";
import { NextResponse } from "next/server";

// Lets an admin trigger the same rotation the daily cron runs, on demand —
// useful given Vercel's Hobby plan only guarantees one (imprecise) cron
// invocation per day. Protected by normal admin session auth, not CRON_SECRET.
export async function POST() {
  const admin = await requireAdmin();
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const summary = await rotateGames();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Manual game rotation failed:", error);
    return NextResponse.json({ error: "Rotation failed." }, { status: 500 });
  }
}
