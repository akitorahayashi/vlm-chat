import { z } from 'zod';

type RawEnv = Record<string, string | undefined>;

export type DatabaseEnvironment =
  | {
      kind: 'sqlite';
      databaseUrl: string;
    }
  | {
      kind: 'turso';
      databaseUrl: string;
      authToken: string;
    };

const requiredString = (name: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value : ''),
    z.string().min(1, { message: `${name} is required.` }),
  );

const optionalString = () =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.length > 0 ? value : undefined,
    z.string().optional(),
  );

const databaseSchema = z.object({
  DATABASE_URL: requiredString('DATABASE_URL'),
  TURSO_AUTH_TOKEN: optionalString(),
});

const systemTestPortSchema = z.coerce.number().int().positive();

function parseDatabaseEnv(raw: RawEnv) {
  const result = databaseSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? 'Invalid database environment.',
    );
  }

  return result.data;
}

export function getDatabaseEnvironment(
  raw: RawEnv = process.env,
): DatabaseEnvironment {
  const parsed = parseDatabaseEnv(raw);
  const isLocal =
    parsed.DATABASE_URL.startsWith('file:') ||
    parsed.DATABASE_URL.startsWith('sqlite:');

  if (isLocal) {
    if (parsed.TURSO_AUTH_TOKEN) {
      throw new Error(
        'TURSO_AUTH_TOKEN must not be set for a local SQLite database.',
      );
    }

    return {
      kind: 'sqlite',
      databaseUrl: parsed.DATABASE_URL,
    };
  }

  const isTurso =
    parsed.DATABASE_URL.startsWith('libsql://') ||
    parsed.DATABASE_URL.startsWith('https://');

  if (!isTurso) {
    throw new Error(
      'DATABASE_URL must use file:, sqlite:, libsql://, or https://.',
    );
  }

  if (!parsed.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is required for a Turso database.');
  }

  return {
    kind: 'turso',
    databaseUrl: parsed.DATABASE_URL,
    authToken: parsed.TURSO_AUTH_TOKEN,
  };
}

export function getTursoEnvironment(raw: RawEnv = process.env) {
  const database = getDatabaseEnvironment(raw);

  if (database.kind !== 'turso') {
    throw new Error('This command requires a Turso DATABASE_URL.');
  }

  return database;
}

export function getSystemTestPort(raw: RawEnv = process.env, fallback = 3001) {
  const value = raw.NEXT_BUN_SYSTEM_TEST_PORT;

  if (value === undefined) {
    console.warn(`NEXT_BUN_SYSTEM_TEST_PORT is not set. Using ${fallback}.`);
    return fallback;
  }

  const parsed = systemTestPortSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `NEXT_BUN_SYSTEM_TEST_PORT must be a positive integer: received "${value}"`,
    );
  }

  return parsed.data;
}
