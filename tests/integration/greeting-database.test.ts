import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), 'next-bun-greeting-'),
);
const databaseUrl = `file:${path.join(temporaryDirectory, 'test.db')}`;

function runBun(args: string[]) {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };
  delete environment.TURSO_AUTH_TOKEN;

  const result = Bun.spawnSync({
    cmd: [process.execPath, ...args],
    cwd: process.cwd(),
    env: environment,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr);
    const stdout = new TextDecoder().decode(result.stdout);
    throw new Error(stderr || stdout || 'Command failed.');
  }
}

describe('greeting database', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    delete process.env.TURSO_AUTH_TOKEN;

    runBun(['x', '--bun', 'prisma', 'migrate', 'deploy']);
    runBun(['run', 'db:seed']);
    runBun(['run', 'db:seed']);
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$disconnect();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('reads the idempotently seeded home greeting', async () => {
    const { readHomeGreeting } = await import('@/features/greeting/read');

    await expect(readHomeGreeting()).resolves.toBe('Hello, world!');
  });
});
