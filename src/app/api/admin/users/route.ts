import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/admin/users — list users (admin only)
// Query params: ?page=1&search=phoneOrName&limit=20
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const search = searchParams.get("search") || "";

  const where = search
    ? {
        OR: [
          { phoneNumber: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        kycLevel: true,
        kycStatus: true,
        role: true,
        createdAt: true,
        wallet: { select: { balance: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      phoneNumber: u.phoneNumber,
      name: u.name,
      kycLevel: u.kycLevel,
      kycStatus: u.kycStatus,
      role: u.role,
      walletBalance: u.wallet?.balance ?? 0,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}