import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

// Real Google login. Activates automatically once GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and NEXTAUTH_SECRET are set in environment variables.
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
})

export { handler as GET, handler as POST }
