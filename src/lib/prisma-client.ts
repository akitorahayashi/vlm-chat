import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@/generated/prisma/client';
import {
  type DatabaseEnvironment,
  getDatabaseEnvironment,
} from './environment';

export function createPrismaClient(
  environment: DatabaseEnvironment = getDatabaseEnvironment(),
) {
  const adapter = new PrismaLibSql({
    url: environment.databaseUrl,
    authToken: environment.kind === 'turso' ? environment.authToken : undefined,
  });

  return new PrismaClient({
    log: ['error'],
    adapter,
  });
}
