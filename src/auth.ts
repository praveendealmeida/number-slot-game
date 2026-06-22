import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The custom-output generated client is structurally a PrismaClient; the cast
  // bridges the nominal type the adapter expects from "@prisma/client".
  adapter: PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0],
  ),
  session: { strategy: "database" },
  providers: [Google],
  callbacks: {
    session({ session, user }) {
      // Expose the DB user id + role on the session for the app + API guards.
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
  events: {
    // First-time admin bootstrap: if a newly created user's email matches
    // ADMIN_EMAIL, promote them. (Promotion happens once, on first sign-in.)
    async createUser({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
      if (adminEmail && user.id && user.email?.toLowerCase() === adminEmail) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
