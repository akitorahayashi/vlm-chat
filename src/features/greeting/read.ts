import { prisma } from '@/lib/prisma';

export async function readHomeGreeting() {
  const greeting = await prisma.greeting.findUnique({
    where: { key: 'home' },
    select: { message: true },
  });

  if (!greeting) {
    throw new Error('Home greeting is missing. Run `bun run db:seed`.');
  }

  return greeting.message;
}
