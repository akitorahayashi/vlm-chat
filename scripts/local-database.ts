import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { getDatabaseUrl } from '../src/lib/environment.ts';

function getDatabasePaths() {
  const databaseUrl = getDatabaseUrl();
  const relativePath = databaseUrl
    .replace(/^(file:|sqlite:)/, '')
    .split('?')[0]
    .split('#')[0];
  const absolutePath = path.resolve(process.cwd(), relativePath);

  return [absolutePath, `${absolutePath}-wal`, `${absolutePath}-shm`];
}

function ensureDatabaseDirectory() {
  mkdirSync(path.dirname(getDatabasePaths()[0]), { recursive: true });
}

function runBun(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertNoArguments(command: string, args: string[]) {
  if (args.length > 0) {
    throw new Error(`${command} does not accept extra arguments.`);
  }
}

function resetDatabase() {
  for (const databasePath of getDatabasePaths()) {
    rmSync(databasePath, { force: true });
  }

  runBun(['x', '--bun', 'prisma', 'migrate', 'deploy']);
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  ensureDatabaseDirectory();

  switch (command) {
    case 'setup':
      assertNoArguments('setup', args);
      runBun(['x', '--bun', 'prisma', 'generate']);
      runBun(['x', '--bun', 'prisma', 'migrate', 'deploy']);
      return;
    case 'migrate':
      runBun(['x', '--bun', 'prisma', 'migrate', 'dev', ...args]);
      return;
    case 'reset':
      assertNoArguments('reset', args);
      resetDatabase();
      return;
    case 'studio':
      assertNoArguments('studio', args);
      runBun(['x', '--bun', 'prisma', 'studio']);
      return;
    default:
      throw new Error(
        'Usage: bun scripts/local-database.ts <setup|migrate|reset|studio>',
      );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
