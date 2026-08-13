import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { describeError } from '../src/lib/describe-error.ts';
import { getDatabaseUrl } from '../src/lib/environment.ts';
import { runBun } from './run-bun.ts';

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
  console.error(describeError(error));
  process.exitCode = 1;
}
