import { getDatabase } from './database';

export async function getAICache(cardId: string): Promise<{
  text: string | null;
  generatedAt: string | null;
}> {
  const db = await getDatabase();
  const card = await db.getFirstAsync<{ ai_explain: string | null }>(
    'SELECT ai_explain FROM cards WHERE id = ?',
    cardId,
  );
  const time = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'ai_generated_at'",
  );
  return {
    text: card?.ai_explain ?? null,
    generatedAt: time?.value ?? null,
  };
}

export async function saveAICache(
  cardId: string,
  text: string,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE cards SET ai_explain = ? WHERE id = ?', text, cardId);
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES ('ai_generated_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      now,
    );
  });
}

export async function clearAICache(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE cards SET ai_explain = NULL');
    await db.runAsync("DELETE FROM settings WHERE key = 'ai_generated_at'");
  });
}
