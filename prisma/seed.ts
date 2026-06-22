import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env before seeding.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Users are created by Google sign-in, so we only seed sample games.
  await prisma.ticket.deleteMany();
  await prisma.game.deleteMany();

  await prisma.game.createMany({
    data: [
      { title: "Rs. 100 Game", ticketPrice: 100, payoutPercent: 80 },
      { title: "Rs. 500 Game", ticketPrice: 500, payoutPercent: 80 },
      { title: "Rs. 1000 Game", ticketPrice: 1000, payoutPercent: 85 },
    ],
  });

  console.log("Seeded 3 games (Rs. 100 / 500 / 1000).");
  console.log(
    "To get an admin: set ADMIN_EMAIL in .env, then sign in with that Google account.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
