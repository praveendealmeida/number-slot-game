import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// OTP Service — server-side OTP generation, storage, and verification.
//
// Notify.lk is used ONLY as the SMS delivery transport (it has no OTP
// generation or verification endpoint — see developer.notify.lk/api-endpoints).
//
// Modes:
//   OTP_MODE=sandbox  → fixed test code (OTP_TEST_CODE), no real SMS sent.
//   OTP_MODE=notify   → generates a secure 6-digit OTP, sends it via
//                       Notify.lk Send SMS, stores a bcrypt hash in the DB.
//
// Security:
//   - OTP stored as bcrypt hash (never plaintext)
//   - 5-minute TTL
//   - Max 5 verify attempts per OTP
//   - OTP deleted on successful use
//   - Generic "invalid or expired" error (never reveals if OTP exists)
// ---------------------------------------------------------------------------

const OTP_MODE = (process.env.OTP_MODE ?? "sandbox") as "sandbox" | "notify";
const OTP_TEST_CODE = process.env.OTP_TEST_CODE ?? "123456";
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

function isSandbox(): boolean {
  return OTP_MODE === "sandbox";
}

/**
 * Normalises a Sri Lankan phone number to Notify.lk format: 94XXXXXXXXX
 * (94 + 9 digits, no +, no spaces, no dashes).
 *
 * Accepts: 0771234567, +94771234567, 94771234567
 * Returns: 94771234567 (or null if invalid)
 */
export function normaliseSLPhone(input: string): string | null {
  const stripped = input.replace(/[\s-]/g, "");

  // 0xxxxxxxxx — 10 digits starting with 0
  if (/^0\d{9}$/.test(stripped)) {
    return `94${stripped.slice(1)}`;
  }

  // +94xxxxxxxxx — 12 chars starting with +94
  if (/^\+94\d{9}$/.test(stripped)) {
    return stripped.slice(1); // remove leading +
  }

  // 94xxxxxxxxx — 11 digits starting with 94
  if (/^94\d{9}$/.test(stripped)) {
    return stripped;
  }

  return null;
}

export type SendOTPResult = {
  success: boolean;
  message: string;
  demoCode?: string;
};

/**
 * Sends an OTP to the given phone number.
 *
 * sandbox: stores the fixed test code (hashed) and returns it for demo display.
 * notify:  generates a secure 6-digit OTP, sends it via Notify.lk, stores hash.
 */
export async function sendOTP(phoneNumber: string): Promise<SendOTPResult> {
  const normalised = normaliseSLPhone(phoneNumber);
  if (!normalised) {
    return { success: false, message: "Invalid Sri Lankan phone number." };
  }

  const code = isSandbox() ? OTP_TEST_CODE : generateSecureOTP();
  const codeHash = await bcrypt.hash(code, 10);

  // Invalidate any previous unused OTPs for this phone (one active OTP at a time)
  await prisma.otpCode.updateMany({
    where: { phoneNumber: normalised, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      phoneNumber: normalised,
      code: codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
  });

  if (isSandbox()) {
    return {
      success: true,
      message: "OTP sent (sandbox mode)",
      demoCode: code,
    };
  }

  // Send via Notify.lk Send SMS endpoint
  const smsResult = await sendSmsViaNotify(normalised, code);
  if (!smsResult.success) {
    return { success: false, message: smsResult.message };
  }

  return { success: true, message: "OTP sent" };
}

export type VerifyOTPResult =
  | { success: true; phoneNumber: string }
  | { success: false; message: string };

/**
 * Verifies an OTP code for the given phone number.
 *
 * Checks the most recent unused, unexpired OTP. Compares against the stored
 * bcrypt hash. On success, deletes the OTP (one-time use). On failure,
 * increments the attempt counter and returns a generic error.
 */
export async function verifyOTP(
  phoneNumber: string,
  code: string,
): Promise<VerifyOTPResult> {
  const normalised = normaliseSLPhone(phoneNumber);
  if (!normalised) {
    return { success: false, message: "Invalid Sri Lankan phone number." };
  }

  const otpCode = await prisma.otpCode.findFirst({
    where: {
      phoneNumber: normalised,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  // Generic error — never reveal whether an OTP exists
  if (!otpCode) {
    return { success: false, message: "Invalid or expired OTP." };
  }

  // Enforce max attempts
  if (otpCode.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { used: true },
    });
    return { success: false, message: "Too many attempts. Please request a new OTP." };
  }

  // Increment attempt counter
  await prisma.otpCode.update({
    where: { id: otpCode.id },
    data: { attempts: { increment: 1 } },
  });

  const valid = await bcrypt.compare(code, otpCode.code);
  if (!valid) {
    return { success: false, message: "Invalid or expired OTP." };
  }

  // One-time use — delete on success
  await prisma.otpCode.delete({ where: { id: otpCode.id } });

  return { success: true, phoneNumber: normalised };
}

// ── Notify.lk SMS transport ──────────────────────────────────────────────

/**
 * Sends an SMS via Notify.lk Send SMS endpoint.
 * Docs: https://developer.notify.lk/api-endpoints/#send-sms
 * URL: https://app.notify.lk/api/v1/send
 * Params: user_id, api_key, sender_id, to (94XXXXXXXXX), message
 */
async function sendSmsViaNotify(
  to: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  const userId = process.env.NOTIFY_LK_USER_ID;
  const apiKey = process.env.NOTIFY_LK_API_KEY;
  const senderId = process.env.NOTIFY_LK_SENDER_ID ?? "NotifyDEMO";

  if (!userId || !apiKey) {
    return {
      success: false,
      message: "Notify.lk is not configured. Set NOTIFY_LK_USER_ID and NOTIFY_LK_API_KEY.",
    };
  }

  const message = `Please use the code ${code} to verify your Lucky Lanka account.`;

  const params = new URLSearchParams({
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    to,
    message,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`https://app.notify.lk/api/v1/send?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await response.json()) as { status?: string; data?: unknown };

    if (response.ok && data.status === "success") {
      return { success: true, message: "OTP sent" };
    }

    // Notify.lk returned an error — log the full response server-side
    // but return a safe generic message to the client.
    console.error("Notify.lk send failed:", JSON.stringify(data));
    return {
      success: false,
      message: "SMS delivery failed. Please try again later.",
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("Notify.lk request timed out after 10s");
    } else {
      console.error("Notify.lk request error:", err instanceof Error ? err.message : err);
    }
    return {
      success: false,
      message: "SMS delivery failed. Please try again later.",
    };
  }
}

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
function generateSecureOTP(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}
