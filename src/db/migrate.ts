import { getDatabase } from './database';
import {
  CREATE_TABLES,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
} from './schema';
import { seedIfNeeded } from './seed';

let initialization: Promise<void> | null = null;

async function runMigration(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;',
  );
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const version = row?.user_version ?? 0;
  if (version < SCHEMA_VERSION) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(CREATE_TABLES);
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    });
  }
  for (const [key, value] of DEFAULT_SETTINGS) {
    await db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }
  await seedIfNeeded();
}

export function initializeDatabase(): Promise<void> {
  if (!initialization) {
    initialization = runMigration().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}
