import { SignJWT, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Mobile authentication bridge (phone-OTP based).
//
// The web app uses NextAuth (database session cookies). The mobile app
// authenticates with phone OTP on-device, sends the verified phone number,
// and we hand back a short-lived, signed session token the app stores and
// sends as `Authorization: Bearer <token>` on subsequent requests.
//
// This does NOT touch the existing NextAuth/web flow — it's an additive path.
// ---------------------------------------------------------------------------

const MOBILE_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — not permanent, always re-validated.

function mobileAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — required to sign mobile session tokens.");
  }
  return new TextEncoder().encode(secret);
}

export type MobileSessionPayload = {
  sub: string; // user id
  tv: number; // token version — must match the user's current mobileTokenVersion
};

/**
 * Issues a short-lived, signed mobile session token. Stateless (no DB row to
 * revoke by itself), but every protected request re-fetches the user from the
 * DB (see `getCurrentUser` in `src/lib/auth.ts`) and compares `tokenVersion`
 * against the user's current `mobileTokenVersion` — bumping that column
 * instantly revokes every previously-issued token for that user (e.g. "sign
 * out of all devices", or an admin-forced logout on a compromised account).
 */
export async function createMobileSessionToken(
  userId: string,
  tokenVersion: number,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + MOBILE_SESSION_TTL_SECONDS;

  const token = await new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(mobileAuthSecret());

  return { token, expiresAt: new Date(exp * 1000) };
}

/**
 * Verifies a mobile session token's signature and expiration. Throws if
 * invalid/expired. Does not by itself confirm the user still exists, has the
 * claimed role, or that the token hasn't been revoked via a token-version
 * bump — callers must re-check both against the database.
 */
export async function verifyMobileSessionToken(token: string): Promise<MobileSessionPayload> {
  const { payload } = await jwtVerify(token, mobileAuthSecret(), {
    algorithms: ["HS256"],
  });

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Mobile session token missing subject.");
  }

  const tv = typeof payload.tv === "number" ? payload.tv : 0;

  return { sub: payload.sub, tv };
}
