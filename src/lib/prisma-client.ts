import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';
import { getDatabaseUrl } from './environment';

export function createPrismaClient(url = getDatabaseUrl()) {
  return new PrismaClient({
    log: ['error'],
    adapter: new PrismaLibSql({ url }),
  });
}
