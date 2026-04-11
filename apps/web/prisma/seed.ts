import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const GIFT_TYPES = [
  { slug: "clap", emoji: "👏", label: "Aplauso", priceAmount: "0.10", sortOrder: 1 },
  { slug: "heart", emoji: "❤️", label: "Corazón", priceAmount: "0.25", sortOrder: 2 },
  { slug: "rose", emoji: "🌹", label: "Rosa", priceAmount: "0.50", sortOrder: 3 },
  { slug: "ball", emoji: "⚽", label: "Pelota", priceAmount: "0.50", sortOrder: 4 },
  { slug: "fire", emoji: "🔥", label: "Fuego", priceAmount: "1.00", sortOrder: 5 },
  { slug: "star", emoji: "⭐", label: "Estrella", priceAmount: "1.00", sortOrder: 6 },
  { slug: "confetti", emoji: "🎉", label: "Celebración", priceAmount: "2.00", sortOrder: 7 },
  { slug: "trophy", emoji: "🏆", label: "Trofeo", priceAmount: "5.00", sortOrder: 8 },
  { slug: "diamond", emoji: "💎", label: "Diamante", priceAmount: "10.00", sortOrder: 9 },
];

async function main() {
  console.log("Seeding gift types...");

  for (const gift of GIFT_TYPES) {
    await prisma.giftType.upsert({
      where: { slug: gift.slug },
      update: { emoji: gift.emoji, label: gift.label, priceAmount: gift.priceAmount, sortOrder: gift.sortOrder },
      create: { ...gift, priceAsset: "USDC" },
    });
    console.log(`  ✔ ${gift.emoji} ${gift.label} — $${gift.priceAmount} USDC`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
