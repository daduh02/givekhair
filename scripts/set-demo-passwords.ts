import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  const passwordHash = hashPassword("GiveKhair123!");
  const emails = [
    "admin@givekhair.dev",
    "charity@givekhair.dev",
    "amina@example.com",
    "yusuf@example.com",
    "fatima@example.com",
  ];

  const result = await db.user.updateMany({
    where: { email: { in: emails } },
    data: { passwordHash, emailVerified: new Date() },
  });

  console.log(`Updated ${result.count} user passwords.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
