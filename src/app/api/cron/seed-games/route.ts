import { seedDailyTierGames } from "@/services/game-seeder";

// POST /api/cron/seed-games — called by Vercel cron at 12 PM daily
// Protected by CRON_SECRET header
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedDailyTierGames();
  return Response.json({ success: true, ...result });
}

// GET endpoint for manual admin testing
export async function GET() {
  const result = await seedDailyTierGames();
  return Response.json({ success: true, ...result });
}