import { sendOTP, normaliseSLPhone } from "@/services/otp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/auth/phone/send-otp
//
// Sends an OTP code to a Sri Lankan phone number.
//
// Rate limited: max 5 requests per phone per hour.
// In sandbox mode (OTP_MODE=sandbox), returns the test code for demo display.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
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

  if (!phoneNumber) {
    return Response.json({ error: "phoneNumber is required." }, { status: 400 });
  }

  const normalised = normaliseSLPhone(phoneNumber);
  if (!normalised) {
    return Response.json(
      { error: "Invalid Sri Lankan phone number. Use 077xxxxxxx or +9477xxxxxxx." },
      { status: 400 },
    );
  }

  // Rate limit per normalised phone number
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `send-otp:${normalised}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many OTP requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const result = await sendOTP(normalised);

  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json(result, { status: 200 });
}