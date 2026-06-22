import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated into src/generated/prisma and pulls in the
  // pg driver. Keep it external to the server bundle so it loads at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
