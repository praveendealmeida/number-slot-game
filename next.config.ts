import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated into src/generated/prisma and pulls in the
  // pg driver. Keep it external to the server bundle so it loads at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // CORS — required when testing with Expo Web (browser context).
  // React Native / Expo Go does NOT enforce CORS, but the web target does.
  // Applies only to API routes; not the rest of the application.
  async headers() {
    return [
      {
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;