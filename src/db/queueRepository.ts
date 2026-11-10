import { isSupportedType } from '@/cards';
import { buildQueue, interleaveByDeck } from '@/srs/queue';
import type { Card } from '@/types';
import { getDatabase } from './database';
import { mapCard, type CardRow } from './mappers';

const CARD_SELECT = `
  SELECT c.id, c.deck_id, c.type, c.question, c.code, c.options,
         c.answer, c.payload, c.explain, c.tags, c.difficulty,
         c.source, c.verified_at, c.sort_order
  FROM cards c`;

type QueueSettings = {
  newLimit: number;
  reviewLimit: number;
  enabledDecks: string[];
};

async function readQueueSettings(): Promise<QueueSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('daily_new_limit', 'daily_review_limit', 'enabled_decks')`,
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  let enabledDecks = ['ds', 'co', 'os', 'cn', 'ai', 'agent'];
  try {
    const parsed: unknown = JSON.parse(values.get('enabled_decks') ?? '[]');
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      enabledDecks = parsed;
    }
  } catch {
    enabledDecks = ['ds', 'co', 'os', 'cn', 'ai', 'agent'];
  }
  return {
    newLimit: Number(values.get('daily_new_limit') ?? 15),
    reviewLimit: Number(values.get('daily_review_limit') ?? 80),
    enabledDecks,
  };
}

function enabledClause(count: number): string {
  return count > 0 ? `d.id IN (${Array.from({ length: count }, () => '?').join(',')})` : '0';
}

async function loadQueueParts(opts?: {
  newLimit?: number;
  reviewLimit?: number;
}): Promise<{ due: Card[]; fresh: Card[]; settings: QueueSettings }> {
  const settings = await readQueueSettings();
  const newLimit = Math.max(0, opts?.newLimit ?? settings.newLimit);
  const reviewLimit = Math.max(0, opts?.reviewLimit ?? settings.reviewLimit);
  if (settings.enabledDecks.length === 0 || newLimit + reviewLimit === 0) {
    return { due: [], fresh: [], settings };
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  const deckFilter = enabledClause(settings.enabledDecks.length);
  const dueRows = await db.getAllAsync<CardRow>(
    `${CARD_SELECT}
     JOIN review_states s ON s.card_id = c.id
     JOIN decks d ON d.id = c.deck_id
     WHERE s.due_at <= ? AND s.status != 'new' AND d.enabled = 1
       AND ${deckFilter}
       AND (c.source = 'seed' OR c.verified_at IS NOT NULL)
     ORDER BY s.due_at ASC LIMIT ?`,
    now,
    ...settings.enabledDecks,
    reviewLimit,
  );
  const newRows = await db.getAllAsync<CardRow>(
    `${CARD_SELECT}
     JOIN review_states s ON s.card_id = c.id
     JOIN decks d ON d.id = c.deck_id
     WHERE s.status = 'new' AND d.enabled = 1
       AND ${deckFilter}
       AND (c.source = 'seed' OR c.verified_at IS NOT NULL)
     ORDER BY d.sort_order ASC, c.sort_order ASC LIMIT ?`,
    ...settings.enabledDecks,
    newLimit,
  );

  return {
    due: dueRows.map(mapCard).filter((card) => isSupportedType(card.type)),
    fresh: newRows.map(mapCard).filter((card) => isSupportedType(card.type)),
    settings,
  };
}

export async function buildTodayQueue(opts?: {
  newLimit?: number;
  reviewLimit?: number;
}): Promise<Card[]> {
  const parts = await loadQueueParts(opts);
  return buildQueue({
    dueCards: parts.due,
    newCards: parts.fresh,
    newLimit: opts?.newLimit ?? parts.settings.newLimit,
    reviewLimit: opts?.reviewLimit ?? parts.settings.reviewLimit,
  });
}

export async function getQueueCounts(): Promise<{
  due: number;
  newCards: number;
  total: number;
}> {
  const parts = await loadQueueParts();
  return {
    due: parts.due.length,
    newCards: parts.fresh.length,
    total: parts.due.length + parts.fresh.length,
  };
}

export async function getNextDueSummary(): Promise<{
  tomorrow: number;
  threeDays: number;
  sevenDays: number;
}> {
  const settings = await readQueueSettings();
  if (settings.enabledDecks.length === 0) {
    return { tomorrow: 0, threeDays: 0, sevenDays: 0 };
  }
  const db = await getDatabase();
  const now = new Date();
  const days = [1, 3, 7].map(
    (day) => new Date(now.getTime() + day * 86_400_000).toISOString(),
  );
  const row = await db.getFirstAsync<{
    tomorrow: number;
    three_days: number;
    seven_days: number;
  }>(
    `SELECT SUM(CASE WHEN s.due_at <= ? THEN 1 ELSE 0 END) AS tomorrow,
            SUM(CASE WHEN s.due_at <= ? THEN 1 ELSE 0 END) AS three_days,
            SUM(CASE WHEN s.due_at <= ? THEN 1 ELSE 0 END) AS seven_days
     FROM review_states s
     JOIN cards c ON c.id = s.card_id
     JOIN decks d ON d.id = c.deck_id
     WHERE s.status != 'new' AND d.enabled = 1
       AND ${enabledClause(settings.enabledDecks.length)}`,
    ...days,
    ...settings.enabledDecks,
  );
  return {
    tomorrow: row?.tomorrow ?? 0,
    threeDays: row?.three_days ?? 0,
    sevenDays: row?.seven_days ?? 0,
  };
}

export async function advanceAllDueByOneDay(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE review_states
     SET due_at = strftime('%Y-%m-%dT%H:%M:%fZ', due_at, '-1 day')`,
  );
}

export { interleaveByDeck };
