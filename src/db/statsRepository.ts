import type { Card, DailyStat } from '@/types';
import { isSupportedType } from '@/cards';
import type { CardRow } from './mappers';
import { mapCard } from './mappers';
import { getDatabase } from './database';

const CARD_COLUMNS = `
  c.id, c.deck_id, c.type, c.question, c.code, c.options,
  c.answer, c.explain, c.tags, c.difficulty`;

export type StatsOverview = {
  streak: number;
  total: number;
  accuracy: number;
  hasData: boolean;
};

export type DeckAccuracy = {
  deckId: string;
  name: string;
  code: string;
  accent: string;
  accuracy: number;
  done: number;
};

export type WrongCardItem = {
  card: Card;
  lapses: number;
  lastWrongAt: string | null;
};

export async function getStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ day: string }>(
    'SELECT DISTINCT day FROM review_logs ORDER BY day DESC',
  );
  if (rows.length === 0) {
    return 0;
  }
  const days = new Set(rows.map((row) => row.day));
  const cursor = new Date();
  let streak = 0;
  while (true) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    if (!days.has(key)) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; correct: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
     FROM review_logs`,
  );
  const total = row?.total ?? 0;
  return {
    streak: await getStreak(),
    total,
    accuracy: total > 0 ? (row?.correct ?? 0) / total : 0,
    hasData: total > 0,
  };
}

export async function getDailySeries(days: 7 | 30 | 35): Promise<DailyStat[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyStat>(
    `SELECT day, COUNT(*) AS done, COALESCE(SUM(is_correct), 0) AS correct
     FROM review_logs
     GROUP BY day ORDER BY day DESC LIMIT ?`,
    days,
  );
}

export async function getDeckAccuracy(): Promise<DeckAccuracy[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    deck_id: string;
    name: string;
    code: string;
    accent: string;
    done: number;
    correct: number;
  }>(
    `SELECT d.id AS deck_id, d.name, d.code, d.accent,
            COUNT(l.id) AS done, COALESCE(SUM(l.is_correct), 0) AS correct
     FROM decks d
     JOIN cards c ON c.deck_id = d.id
     JOIN review_logs l ON l.card_id = c.id
     GROUP BY d.id
     ORDER BY (CAST(SUM(l.is_correct) AS REAL) / COUNT(l.id)) ASC`,
  );
  return rows.map((row) => ({
    deckId: row.deck_id,
    name: row.name,
    code: row.code,
    accent: row.accent,
    accuracy: row.done > 0 ? row.correct / row.done : 0,
    done: row.done,
  }));
}

type WrongRow = CardRow & {
  lapses: number;
  last_wrong_at: string | null;
};

function mapWrong(row: WrongRow): WrongCardItem {
  return {
    card: mapCard(row),
    lapses: row.lapses,
    lastWrongAt: row.last_wrong_at,
  };
}

export async function getWrongCards(limit: number): Promise<WrongCardItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<WrongRow>(
    `SELECT ${CARD_COLUMNS}, s.lapses,
            MAX(CASE WHEN l.is_correct = 0 THEN l.answered_at END) AS last_wrong_at
     FROM review_states s
     JOIN cards c ON c.id = s.card_id
     JOIN decks d ON d.id = c.deck_id
     LEFT JOIN review_logs l ON l.card_id = c.id
     WHERE s.lapses > 0 AND d.enabled = 1
     GROUP BY c.id
     ORDER BY last_wrong_at DESC
     LIMIT ?`,
    limit,
  );
  return rows.map(mapWrong).filter((item) => isSupportedType(item.card.type));
}

export async function getWrongCard(id: string): Promise<WrongCardItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WrongRow>(
    `SELECT ${CARD_COLUMNS}, s.lapses,
            MAX(CASE WHEN l.is_correct = 0 THEN l.answered_at END) AS last_wrong_at
     FROM review_states s
     JOIN cards c ON c.id = s.card_id
     LEFT JOIN review_logs l ON l.card_id = c.id
     WHERE s.card_id = ? AND s.lapses > 0
     GROUP BY c.id`,
    id,
  );
  return row ? mapWrong(row) : null;
}

export async function requeueWrongCard(cardId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE review_states
     SET due_at = ?, status = 'lapsed'
     WHERE card_id = ?`,
    new Date().toISOString(),
    cardId,
  );
}
