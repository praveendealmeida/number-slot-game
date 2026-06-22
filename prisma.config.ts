import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads the connection URL from schema.prisma and no longer
// auto-loads .env. The runtime client connects via the driver adapter
// (see src/lib/db.ts); the CLI (migrate / db push / studio / seed) uses the URL
// below. We read process.env directly (not the strict `env()` helper) so that
// `prisma generate` still works before .env is configured — generate doesn't
// need a database connection. db push / migrate / seed will require it.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
