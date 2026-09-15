/**
 * Promoveaza un cont existent la rol de admin (si il aproba, daca era in
 * asteptare) - singura cale de a crea primul admin, ca nu exista UI pentru asta.
 *
 *   npm run promote-admin -w @foodbook/backend -- cineva@exemplu.ro
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Foloseste: npm run promote-admin -w @foodbook/backend -- <email>');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', status: 'APPROVED' },
  });

  console.log(`OK: ${user.username} (${user.email}) e acum admin.`);
}

main()
  .catch((err) => {
    console.error('Promovarea a esuat:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
