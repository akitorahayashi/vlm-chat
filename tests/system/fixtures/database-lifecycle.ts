import { createClient } from '@libsql/client';

export const SYSTEM_DATABASE_URL = 'file:./data/system-test.db';

async function clearSystemDatabase() {
  const client = createClient({ url: SYSTEM_DATABASE_URL });

  try {
    await client.execute('PRAGMA busy_timeout = 5000');
    await client.batch(
      [
        'DELETE FROM Attachment',
        'DELETE FROM Message',
        'DELETE FROM Conversation',
      ],
      'write',
    );
  } finally {
    client.close();
  }
}

export default async function clearSystemDatabaseAroundRun() {
  await clearSystemDatabase();

  return clearSystemDatabase;
}
