import { applyPendingMigrations, createTursoClient } from './turso-database.ts';

async function main() {
  const client = createTursoClient();

  try {
    await applyPendingMigrations(client);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
