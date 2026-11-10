import type { Card, DailyStat, Deck } from '@/types';
import { isSupportedType } from '@/cards';
import { initializeDatabase } from './migrate';
import { getDatabase } from './database';
import { mapCard, mapDeck, type CardRow, type DeckRow } from './mappers';
import type { GradeResult } from '@/cards/registry';
import { todayKey } from '@/utils/date';

const CARD_SELECT = `
  SELECT c.id, c.deck_id, c.type, c.question, c.code, c.options,
         c.answer, c.explain, c.tags, c.difficulty
  FROM cards c`;

export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}

export async function listDecks(): Promise<Deck[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DeckRow>(
    'SELECT * FROM decks ORDER BY sort_order ASC',
  );
  return rows.map(mapDeck);
}

export async function getDeckProgress(
  deckId: string,
): Promise<{ total: number; learned: number; due: number }> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const row = await db.getFirstAsync<{
    total: number;
    learned: number;
    due: number;
  }>(
    `SELECT COUNT(c.id) AS total,
            SUM(CASE WHEN s.status <> 'new' THEN 1 ELSE 0 END) AS learned,
            SUM(CASE WHEN s.due_at <= ? AND s.status <> 'new' THEN 1 ELSE 0 END) AS due
     FROM cards c JOIN review_states s ON s.card_id = c.id
     WHERE c.deck_id = ?`,
    now,
    deckId,
  );
  return {
    total: row?.total ?? 0,
    learned: row?.learned ?? 0,
    due: row?.due ?? 0,
  };
}

export async function listCardsByDeck(deckId: string): Promise<Card[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CardRow>(
    `${CARD_SELECT} WHERE c.deck_id = ? ORDER BY c.sort_order ASC`,
    deckId,
  );
  return rows.map(mapCard).filter((card) => isSupportedType(card.type));
}

export async function buildTodayQueue(opts: {
  newLimit: number;
  reviewLimit: number;
}): Promise<Card[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CardRow>(
    `${CARD_SELECT}
     JOIN review_states s ON s.card_id = c.id
     JOIN decks d ON d.id = c.deck_id
     WHERE s.status = 'new' AND d.enabled = 1
       AND (c.source = 'seed' OR c.verified_at IS NOT NULL)
     ORDER BY d.sort_order ASC, c.sort_order ASC
     LIMIT ?`,
    Math.min(opts.newLimit, opts.newLimit + opts.reviewLimit),
  );
  return rows.map(mapCard).filter((card) => isSupportedType(card.type));
}

export async function submitAnswer(input: {
  cardId: string;
  deckId: string;
  quality: number;
  isCorrect: boolean;
  elapsedMs: number;
  answerRaw?: string;
  grade?: GradeResult;
}): Promise<{
  nextDueAt: string;
  intervalDays: number;
  ease: number;
  status: string;
}> {
  const db = await getDatabase();
  const now = new Date();
  const failed = input.quality < 3;
  const intervalDays = failed ? 0 : 1;
  const dueAt = new Date(
    now.getTime() + (failed ? 10 * 60 * 1000 : 24 * 60 * 60 * 1000),
  ).toISOString();
  const status = failed ? 'lapsed' : 'learning';
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE review_states
       SET due_at = ?, last_quality = ?, last_reviewed_at = ?,
           interval_days = ?, status = ?,
           reps = CASE WHEN ? = 1 THEN reps + 1 ELSE 0 END,
           lapses = CASE WHEN ? = 1 THEN lapses + 1 ELSE lapses END
       WHERE card_id = ?`,
      dueAt,
      input.quality,
      now.toISOString(),
      intervalDays,
      status,
      failed ? 0 : 1,
      failed ? 1 : 0,
      input.cardId,
    );
    await db.runAsync(
      `INSERT INTO review_logs (
        card_id, deck_id, quality, is_correct, elapsed_ms,
        answer_raw, day, answered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.cardId,
      input.deckId,
      input.quality,
      input.isCorrect ? 1 : 0,
      input.elapsedMs,
      input.answerRaw ?? null,
      todayKey(now),
      now.toISOString(),
    );
  });
  return { nextDueAt: dueAt, intervalDays, ease: 2.5, status };
}

export async function getTodayStats(): Promise<{
  done: number;
  correct: number;
  goal: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ done: number; correct: number }>(
    `SELECT COUNT(*) AS done, SUM(is_correct) AS correct
     FROM review_logs WHERE day = ?`,
    todayKey(),
  );
  const goalRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'daily_new_limit'",
  );
  return {
    done: row?.done ?? 0,
    correct: row?.correct ?? 0,
    goal: Number(goalRow?.value ?? 15),
  };
}

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

export async function getDailySeries(
  days: 7 | 30,
): Promise<DailyStat[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyStat>(
    `SELECT day, COUNT(*) AS done, SUM(is_correct) AS correct
     FROM review_logs
     GROUP BY day ORDER BY day DESC LIMIT ?`,
    days,
  );
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
