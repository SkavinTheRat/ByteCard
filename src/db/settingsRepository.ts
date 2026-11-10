import { getDatabase } from './database';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function getLibrarySummary(): Promise<{
  cards: number;
  decks: number;
}> {
  const db = await getDatabase();
  const cardRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM cards',
  );
  const deckRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM decks',
  );
  return { cards: cardRow?.count ?? 0, decks: deckRow?.count ?? 0 };
}

export async function resetProgress(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM review_logs');
    await db.runAsync('DELETE FROM review_states');
    await db.runAsync(
      `INSERT INTO review_states (card_id, due_at, status)
       SELECT id, ?, 'new' FROM cards`,
      new Date().toISOString(),
    );
  });
}
