import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyMobileSessionToken } from "@/lib/mobile-auth";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
};

/**
 * Resolves the current user from a mobile Bearer token, if present.
 *
 * The mobile session token only carries the user's id — role/email/name are
 * always re-fetched fresh from the database here, so a revoked/demoted/
 * deleted user is rejected immediately even if their token hasn't expired.
 */
async function getMobileBearerUser(): Promise<AuthUser | null> {
  const headerList = await headers();
  const authorization = headerList.get("authorization") ?? headerList.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyMobileSessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, mobileTokenVersion: true },
    });

    if (!user) {
      return null;
    }

    // If the user's token version has been bumped since this token was
    // issued (e.g. "sign out of all devices", or an admin-forced revocation),
    // treat the token as invalid even though its signature/expiry check out.
    if (user.mobileTokenVersion !== payload.tv) {
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? null,
      role: user.role,
    };
  } catch {
    // Invalid/expired token — treat as unauthenticated, do not throw.
    return null;
  }
}


export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      role: session.user.role,
    };
  }

  // Fall back to a mobile Bearer token when there's no cookie session.
  return getMobileBearerUser();
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function requireAdmin(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  return user;
}
