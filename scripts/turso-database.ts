import crypto from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { getTursoEnvironment } from '../src/lib/environment.ts';

type TursoClient = ReturnType<typeof createClient>;

type MigrationEntry = {
  name: string;
  sql: string;
  checksum: string;
};

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const migrationsDirectory = path.join(projectRoot, 'prisma', 'migrations');
const migrationsTable = '__next_bun_migrations';

export function createTursoClient() {
  const environment = getTursoEnvironment();

  return createClient({
    url: environment.databaseUrl,
    authToken: environment.authToken,
  });
}

function listMigrations(): MigrationEntry[] {
  const migrations: MigrationEntry[] = [];

  for (const entry of readdirSync(migrationsDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const filePath = path.join(
      migrationsDirectory,
      entry.name,
      'migration.sql',
    );

    if (!existsSync(filePath)) {
      throw new Error(`Migration file is missing: ${filePath}`);
    }

    const sql = readFileSync(filePath, 'utf8');
    migrations.push({
      name: entry.name,
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    });
  }

  return migrations.sort((left, right) => left.name.localeCompare(right.name));
}

async function ensureMigrationsTable(client: TursoClient) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "${migrationsTable}" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function listAppliedMigrations(client: TursoClient) {
  const result = await client.execute(
    `SELECT "name", "checksum" FROM "${migrationsTable}" ORDER BY "name" ASC`,
  );

  return new Map(
    result.rows.map((row) => [String(row.name), String(row.checksum)]),
  );
}

async function listUserTables(client: TursoClient) {
  const result = await client.execute(`
    SELECT "name"
    FROM "sqlite_master"
    WHERE "type" = 'table'
      AND "name" NOT LIKE 'sqlite_%'
    ORDER BY "name" ASC
  `);

  return result.rows.map((row) => String(row.name));
}

export async function applyPendingMigrations(client: TursoClient) {
  const migrations = listMigrations();
  await ensureMigrationsTable(client);

  const [appliedMigrations, userTables] = await Promise.all([
    listAppliedMigrations(client),
    listUserTables(client),
  ]);

  if (appliedMigrations.size === 0 && userTables.length > 1) {
    throw new Error(
      `Remote database already has tables but no ${migrationsTable} records. Baseline it manually before continuing.`,
    );
  }

  for (const migration of migrations) {
    const appliedChecksum = appliedMigrations.get(migration.name);

    if (appliedChecksum) {
      if (appliedChecksum !== migration.checksum) {
        throw new Error(
          `Migration checksum mismatch for ${migration.name}. Refusing to continue.`,
        );
      }

      console.log(`skip ${migration.name}`);
      continue;
    }

    console.log(`apply ${migration.name}`);
    await client.executeMultiple(migration.sql);
    await client.execute({
      sql: `INSERT INTO "${migrationsTable}" ("name", "checksum") VALUES (?, ?)`,
      args: [migration.name, migration.checksum],
    });
  }
}
