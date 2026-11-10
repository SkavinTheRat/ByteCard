import { getDatabase } from './database';
import type { DraftCard } from '@/utils/cardValidate';
import { todayKey } from '@/utils/date';

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

export async function getAIGenerationUsage(): Promise<{
  used: number;
  limit: number;
}> {
  const db = await getDatabase();
  const day = todayKey();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('ai_gen_limit', ?)",
    `ai_gen_count_${day}`,
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    used: Number(values.get(`ai_gen_count_${day}`) ?? 0),
    limit: Number(values.get('ai_gen_limit') ?? 10),
  };
}

export async function recordAIGeneration(): Promise<void> {
  const db = await getDatabase();
  const day = todayKey();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
    `ai_gen_count_${day}`,
  );
}

export async function getExistingQuestions(deckId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ question: string }>(
    'SELECT question FROM cards WHERE deck_id = ?',
    deckId,
  );
  return rows.map((row) => row.question);
}

export async function insertVerifiedAICard(card: DraftCard): Promise<number> {
  const db = await getDatabase();
  const id = `ai-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const max = await db.getFirstAsync<{ value: number | null }>(
      'SELECT MAX(sort_order) AS value FROM cards WHERE deck_id = ?',
      card.deckId,
    );
    await db.runAsync(
      `INSERT INTO cards (
        id, deck_id, type, question, code, options, answer, payload,
        explain, tags, difficulty, source, verified_at, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?)`,
      id,
      card.deckId,
      card.type,
      card.question,
      card.code ?? null,
      card.options === null ? null : JSON.stringify(card.options),
      JSON.stringify(card.answer),
      JSON.stringify(card.payload ?? {}),
      card.explain,
      JSON.stringify(card.tags),
      card.difficulty,
      now,
      (max?.value ?? 0) + 1,
    );
    await db.runAsync(
      `INSERT INTO review_states (card_id, due_at, status) VALUES (?, ?, 'new')`,
      id,
      now,
    );
  });
  const total = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM cards',
  );
  return total?.count ?? 0;
}

export type AICardSummary = {
  id: string;
  deckId: string;
  question: string;
  createdAt: string | null;
};

export async function listAICards(limit = 100): Promise<AICardSummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<AICardSummary>(
    `SELECT id, deck_id AS deckId, question, verified_at AS createdAt
     FROM cards WHERE source = 'ai' AND verified_at IS NOT NULL
     ORDER BY verified_at DESC LIMIT ?`,
    limit,
  );
}

export async function getAICardStats(): Promise<{
  count: number;
  total: number;
  percent: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number; total: number }>(
    `SELECT SUM(CASE WHEN source = 'ai' AND verified_at IS NOT NULL THEN 1 ELSE 0 END) AS count,
            COUNT(*) AS total
     FROM cards`,
  );
  const count = row?.count ?? 0;
  const total = row?.total ?? 0;
  return { count, total, percent: total > 0 ? count / total : 0 };
}

export async function deleteAICards(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = await getDatabase();
  const marks = ids.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM cards WHERE id IN (${marks}) AND source = 'ai'`,
    ...ids,
  );
}

export async function clearAICards(): Promise<number> {
  const stats = await getAICardStats();
  const db = await getDatabase();
  await db.runAsync("DELETE FROM cards WHERE source = 'ai'");
  return stats.count;
}

export async function getAIExportCards(): Promise<Array<Record<string, unknown>>> {
  const db = await getDatabase();
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT id, deck_id AS deckId, type, question, code, options, answer,
            explain, tags, difficulty, payload
     FROM cards WHERE source = 'ai' AND verified_at IS NOT NULL
     ORDER BY verified_at ASC`,
  );
}
