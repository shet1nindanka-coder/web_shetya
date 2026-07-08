import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Использование: npx tsx scripts/create-developer.ts <email> <пароль> [имя]");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      role: UserRole.DEVELOPER,
      passwordHash
    },
    create: {
      name: name?.trim() || "Разработчик",
      email: normalizedEmail,
      passwordHash,
      role: UserRole.DEVELOPER
    }
  });

  console.log(`Готово: ${user.email} — роль DEVELOPER.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
