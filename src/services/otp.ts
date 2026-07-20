import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// OTP Service — sandbox abstraction layer.
//
// Currently operates in sandbox mode (OTP_MODE=sandbox) where every valid
// Sri Lankan phone number receives a fixed test code (OTP_TEST_CODE).
//
// When a real SMS provider is integrated (Dialog / Mobitel / Airtel), only
// the implementation of `sendOTP` needs to change — the API route call sites
// and `verifyOTP` stay exactly the same.
// ---------------------------------------------------------------------------

const OTP_MODE = (process.env.OTP_MODE ?? "sandbox") as "sandbox" | "live";
const OTP_TEST_CODE = process.env.OTP_TEST_CODE ?? "123456";
const OTP_EXPIRY_MINUTES = 10;

function isSandbox(): boolean {
  return OTP_MODE === "sandbox";
}

/**
 * Normalises a Sri Lankan phone number to +94 format.
 * Accepts: 0771234567, +94771234567
 * Returns: +94771234567 (or null if invalid)
 */
export function normaliseSLPhone(input: string): string | null {
  const stripped = input.replace(/[\s-]/g, "");

  // 0xxxxxxxxx — 10 digits starting with 0
  if (/^0\d{9}$/.test(stripped)) {
    return `+94${stripped.slice(1)}`;
  }

  // +94xxxxxxxxx — 12 digits starting with +94
  if (/^\+94\d{9}$/.test(stripped)) {
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
 * In sandbox mode: stores the test code in the database and returns it
 * (for demo display purposes only — production MUST NOT return the code).
 *
 * In live mode: generates a random 6-digit code and sends it via SMS
 * provider (not yet implemented).
 */
export async function sendOTP(phoneNumber: string): Promise<SendOTPResult> {
  const normalised = normaliseSLPhone(phoneNumber);
  if (!normalised) {
    return { success: false, message: "Invalid Sri Lankan phone number." };
  }

  const code = isSandbox() ? OTP_TEST_CODE : generateOTP();

  await prisma.otpCode.create({
    data: {
      phoneNumber: normalised,
      code,
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

  // TODO(live): send SMS via provider here
  // await smsProvider.send(normalised, `Your Lucky Lanka OTP is: ${code}`);

  return { success: true, message: "OTP sent" };
}

export type VerifyOTPResult =
  | { success: true; phoneNumber: string }
  | { success: false; message: string };

/**
 * Verifies an OTP code for the given phone number.
 *
 * Checks that an unused, unexpired code exists for that phone number and
 * matches the provided code. Marks the code as used on success.
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

  if (!otpCode) {
    return {
      success: false,
      message: "No valid OTP found. Please request a new code.",
    };
  }

  // Increment attempt counter
  await prisma.otpCode.update({
    where: { id: otpCode.id },
    data: { attempts: { increment: 1 } },
  });

  if (otpCode.code !== code) {
    return { success: false, message: "Invalid OTP code. Please try again." };
  }

  // Mark as used so it can't be replayed
  await prisma.otpCode.update({
    where: { id: otpCode.id },
    data: { used: true },
  });

  return { success: true, phoneNumber: normalised };
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}