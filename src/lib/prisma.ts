import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';
import { getDatabaseUrl } from './environment';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    adapter: new PrismaLibSql({ url: getDatabaseUrl() }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
