import { requireAdmin } from "@/lib/auth";
import { getFinanceOverview } from "@/lib/finance";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) {
    return admin;
  }

  const overview = await getFinanceOverview();
  return NextResponse.json(overview);
}
