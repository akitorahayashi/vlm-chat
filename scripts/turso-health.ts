import { createTursoClient } from './turso-database.ts';

async function main() {
  const client = createTursoClient();

  try {
    await client.execute('SELECT 1 AS ok');
    const result = await client.execute(`
      SELECT "name"
      FROM "sqlite_master"
      WHERE "type" = 'table'
        AND "name" NOT LIKE 'sqlite_%'
      ORDER BY "name" ASC
    `);

    console.log('Turso health check passed.');
    console.log(`tables: ${result.rows.length}`);

    if (result.rows.length > 0) {
      console.log(result.rows.map((row) => String(row.name)).join('\n'));
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
