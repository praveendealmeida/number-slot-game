import { verifyOTP } from "@/services/otp";
import { createMobileSessionToken } from "@/lib/mobile-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { ensureWallet } from "@/services/daily-game";

// ---------------------------------------------------------------------------
// POST /api/auth/phone/verify-otp
//
// Verifies an OTP code, finds or creates a user by phone number, creates a
// wallet if one doesn't exist, and issues a mobile session JWT.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `verify-otp:${clientIp}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many verification attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const phoneNumber =
    body && typeof body === "object" && "phoneNumber" in body &&
    typeof (body as { phoneNumber: unknown }).phoneNumber === "string"
      ? (body as { phoneNumber: string }).phoneNumber
      : null;

  const code =
    body && typeof body === "object" && "code" in body &&
    typeof (body as { code: unknown }).code === "string"
      ? (body as { code: string }).code
      : null;

  if (!phoneNumber || !code) {
    return Response.json(
      { error: "phoneNumber and code are required." },
      { status: 400 },
    );
  }

  // Verify the OTP
  const result = await verifyOTP(phoneNumber, code);

  if (!result.success) {
    return Response.json({ error: result.message }, { status: 401 });
  }

  const normalisedPhone = result.phoneNumber;

  // Find or create user by phone number
  let user = await prisma.user.findUnique({
    where: { phoneNumber: normalisedPhone },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phoneNumber: true,
      phoneVerified: true,
      kycLevel: true,
      kycStatus: true,
      mobileTokenVersion: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phoneNumber: normalisedPhone,
        phoneVerified: true,
        kycLevel: 1, // Tier 1: Registered
        name: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        phoneVerified: true,
        kycLevel: true,
        kycStatus: true,
        mobileTokenVersion: true,
      },
    });
  } else if (!user.phoneVerified) {
    // Existing user (e.g. created via web admin) — mark phone as verified
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        phoneVerified: true,
        kycLevel: true,
        kycStatus: true,
        mobileTokenVersion: true,
      },
    });
  }

  // Ensure wallet exists with demo balance for new users
  await ensureWallet(user.id);

  // Issue mobile session token using existing JWT infrastructure
  const { token, expiresAt } = await createMobileSessionToken(
    user.id,
    user.mobileTokenVersion,
  );

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified,
        kycLevel: user.kycLevel,
        kycStatus: user.kycStatus,
      },
      token,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 200 },
  );
}