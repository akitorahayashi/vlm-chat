import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * One migrated database for the whole integration run.
 *
 * `src/lib/prisma.ts` builds its client when the module is first loaded, and
 * `bun test` loads every file into one process, so the first temporary database
 * any file created would be the one every other file talked to. Importing this
 * module at the top of a test file sets `DATABASE_URL` before anything can
 * reach that singleton.
 */
const directory = mkdtempSync(path.join(tmpdir(), 'vlm-chat-integration-'));

export const databaseUrl = `file:${path.join(directory, 'test.db')}`;

process.env.DATABASE_URL = databaseUrl;

const migrate = Bun.spawnSync({
  cmd: [process.execPath, 'x', '--bun', 'prisma', 'migrate', 'deploy'],
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdout: 'pipe',
  stderr: 'pipe',
});

if (migrate.exitCode !== 0) {
  const decoder = new TextDecoder();

  throw new Error(
    decoder.decode(migrate.stderr) ||
      decoder.decode(migrate.stdout) ||
      'prisma migrate deploy failed.',
  );
}

process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
