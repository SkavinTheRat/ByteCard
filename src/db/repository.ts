import type { Card, Deck } from '@/types';
import { isSupportedType } from '@/cards';
import { initializeDatabase } from './migrate';
import { getDatabase } from './database';
import { mapCard, mapDeck, type CardRow, type DeckRow } from './mappers';
import type { GradeResult } from '@/cards/registry';
import { todayKey } from '@/utils/date';
import { schedule, type SM2State } from '@/srs/sm2';
import { getQueueCounts } from './queueRepository';

export {
  advanceAllDueByOneDay,
  buildTodayQueue,
  getNextDueSummary,
  getQueueCounts,
  interleaveByDeck,
} from './queueRepository';
export {
  getDailySeries,
  getDeckAccuracy,
  getDeckTagAccuracy,
  getStatsOverview,
  getStreak,
  getUnsupportedCardCount,
  getWrongCard,
  getWrongCards,
  requeueWrongCard,
} from './statsRepository';
export type {
  DeckAccuracy,
  StatsOverview,
  WrongCardItem,
} from './statsRepository';
export {
  clearAICache,
  clearAICards,
  deleteAICards,
  getAICache,
  getAICardStats,
  getAIGenerationUsage,
  getAIExportCards,
  getExistingQuestions,
  insertVerifiedAICard,
  listAICards,
  recordAIGeneration,
  saveAICache,
  type AICardSummary,
} from './aiRepository';
export {
  getLibrarySummary,
  getSetting,
  resetProgress,
  setSetting,
} from './settingsRepository';

const CARD_SELECT = `
  SELECT c.id, c.deck_id, c.type, c.question, c.code, c.options,
         c.answer, c.payload, c.explain, c.tags, c.difficulty,
         c.source, c.verified_at, c.sort_order
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
  let result = schedule(
    { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 },
    input.quality,
    now,
  );
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{
      ease: number;
      interval_days: number;
      reps: number;
      lapses: number;
    }>(
      `SELECT ease, interval_days, reps, lapses
       FROM review_states WHERE card_id = ?`,
      input.cardId,
    );
    const state: SM2State = current
      ? {
          ease: current.ease,
          intervalDays: current.interval_days,
          reps: current.reps,
          lapses: current.lapses,
        }
      : { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
    result = schedule(state, input.quality, now);
    await db.runAsync(
      `INSERT INTO review_states (
        card_id, ease, interval_days, reps, lapses, due_at,
        last_quality, last_reviewed_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        ease = excluded.ease,
        interval_days = excluded.interval_days,
        reps = excluded.reps,
        lapses = excluded.lapses,
        due_at = excluded.due_at,
        last_quality = excluded.last_quality,
        last_reviewed_at = excluded.last_reviewed_at,
        status = excluded.status`,
      input.cardId,
      result.ease,
      result.intervalDays,
      result.reps,
      result.lapses,
      result.nextDueAt.toISOString(),
      input.quality,
      now.toISOString(),
      result.status,
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
  return {
    nextDueAt: result.nextDueAt.toISOString(),
    intervalDays: result.intervalDays,
    ease: result.ease,
    status: result.status,
  };
}

export async function getTodayStats(): Promise<{
  done: number;
  correct: number;
  goal: number;
  due: number;
  newCards: number;
  cleared: boolean;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ done: number; correct: number }>(
    `SELECT COUNT(DISTINCT card_id) AS done,
            SUM(is_correct) AS correct
     FROM review_logs WHERE day = ?`,
    todayKey(),
  );
  const counts = await getQueueCounts();
  const done = row?.done ?? 0;
  return {
    done,
    correct: row?.correct ?? 0,
    goal: done + counts.total,
    due: counts.due,
    newCards: counts.newCards,
    cleared: counts.total === 0,
  };
}
