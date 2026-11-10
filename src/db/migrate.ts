import { getDatabase } from './database';
import {
  CREATE_TABLES,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
} from './schema';
import { seedIfNeeded } from './seed';

let initialization: Promise<void> | null = null;

type ColumnInfo = { name: string };

async function getUserVersion(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  return row?.user_version ?? 0;
}

async function setUserVersion(version: number): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`PRAGMA user_version = ${version};`);
}

async function cardColumns(): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ColumnInfo>('PRAGMA table_info(cards)');
  return new Set(rows.map((row) => row.name));
}

async function addColumnIfMissing(
  columns: Set<string>,
  name: string,
  ddl: string,
): Promise<void> {
  if (columns.has(name)) {
    return;
  }
  const db = await getDatabase();
  await db.execAsync(`ALTER TABLE cards ADD COLUMN ${ddl};`);
  columns.add(name);
}

async function migrateV1(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(CREATE_TABLES);
    await db.execAsync('PRAGMA user_version = 1;');
  });
}

async function migrateV2(): Promise<void> {
  const db = await getDatabase();
  const columns = await cardColumns();
  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(
      columns,
      'source',
      "source TEXT NOT NULL DEFAULT 'seed'",
    );
    await addColumnIfMissing(columns, 'verified_at', 'verified_at TEXT');
    await db.execAsync('PRAGMA user_version = 2;');
  });
}

async function rebuildCardsTable(): Promise<void> {
  const db = await getDatabase();
  const before = await db.getFirstAsync<{ cards: number; states: number; logs: number }>(
    `SELECT (SELECT COUNT(*) FROM cards) AS cards,
            (SELECT COUNT(*) FROM review_states) AS states,
            (SELECT COUNT(*) FROM review_logs) AS logs`,
  );
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE cards_v3 (
          id          TEXT PRIMARY KEY,
          deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
          type        TEXT NOT NULL,
          question    TEXT NOT NULL,
          code        TEXT,
          options     TEXT,
          answer      TEXT NOT NULL,
          payload     TEXT NOT NULL DEFAULT '{}',
          explain     TEXT NOT NULL,
          tags        TEXT NOT NULL DEFAULT '[]',
          difficulty  INTEGER NOT NULL DEFAULT 2,
          ai_explain  TEXT,
          source      TEXT NOT NULL DEFAULT 'seed',
          verified_at TEXT,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO cards_v3 (
          id, deck_id, type, question, code, options, answer, payload,
          explain, tags, difficulty, ai_explain, source, verified_at, sort_order
        )
        SELECT id, deck_id, type, question, code, options, answer, '{}',
               explain, tags, difficulty, ai_explain,
               COALESCE(source, 'seed'), verified_at, COALESCE(sort_order, 0)
        FROM cards;
        DROP TABLE cards;
        ALTER TABLE cards_v3 RENAME TO cards;
        CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
      `);
      const after = await db.getFirstAsync<{ cards: number; states: number; logs: number }>(
        `SELECT (SELECT COUNT(*) FROM cards) AS cards,
                (SELECT COUNT(*) FROM review_states) AS states,
                (SELECT COUNT(*) FROM review_logs) AS logs`,
      );
      if (
        before?.cards !== after?.cards ||
        before?.states !== after?.states ||
        before?.logs !== after?.logs
      ) {
        throw new Error('cards 表重建后数据量发生变化');
      }
      await db.execAsync('PRAGMA user_version = 3;');
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function migrateV3(): Promise<void> {
  const db = await getDatabase();
  const schema = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cards'",
  );
  const columns = await cardColumns();
  const hasTypeCheck = /CHECK\s*\(\s*type\s+IN/i.test(schema?.sql ?? '');
  if (hasTypeCheck) {
    await rebuildCardsTable();
    return;
  }
  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(columns, 'payload', "payload TEXT NOT NULL DEFAULT '{}'");
    await addColumnIfMissing(
      columns,
      'source',
      "source TEXT NOT NULL DEFAULT 'seed'",
    );
    await addColumnIfMissing(columns, 'verified_at', 'verified_at TEXT');
    await db.execAsync('PRAGMA user_version = 3;');
  });
}

async function runMigration(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;',
  );
  let version = await getUserVersion();
  if (version < 1) {
    await migrateV1();
    version = 1;
  }
  if (version < 2) {
    await migrateV2();
    version = 2;
  }
  if (version < 3) {
    await migrateV3();
    version = await getUserVersion();
  }
  if (version > SCHEMA_VERSION) {
    console.warn(`数据库版本 ${version} 高于当前 App 支持的 ${SCHEMA_VERSION}`);
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
