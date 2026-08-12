import { createPrismaClient } from '../src/lib/prisma-client.ts';

const prisma = createPrismaClient();

async function main() {
  await prisma.greeting.upsert({
    where: { key: 'home' },
    update: { message: 'Hello, world!' },
    create: {
      key: 'home',
      message: 'Hello, world!',
    },
  });

  console.log('Seed data created successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
