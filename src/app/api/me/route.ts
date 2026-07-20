import { getCurrentUser } from "@/lib/auth";

// GET /api/me
//
// Returns the currently authenticated user, resolved from either an
// existing NextAuth cookie session (web) or a mobile Bearer token (app).
// Used by the mobile app to restore/validate its session on launch.
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  return Response.json({ user }, { status: 200 });
}
