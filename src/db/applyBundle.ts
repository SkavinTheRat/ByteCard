import type { Card, DeckBundle } from '@/types';
import { getDatabase } from './database';

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

async function appliedVersion(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    'deck_version',
  );
  return Number(row?.value ?? 0);
}

async function deleteRemoved(removed: string[]): Promise<void> {
  if (removed.length === 0) {
    return;
  }
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM cards WHERE id IN (${placeholders(removed.length)})`,
    ...removed,
  );
}

async function upsertDecks(decks: DeckBundle['decks']): Promise<void> {
  if (decks.length === 0) {
    return;
  }
  const db = await getDatabase();
  const rows = decks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params = decks.flatMap((deck) => [
    deck.id,
    deck.name,
    deck.code,
    deck.description,
    deck.accent,
    deck.sortOrder,
    deck.enabled ? 1 : 0,
  ]);
  await db.runAsync(
    `INSERT INTO decks (id, name, code, description, accent, sort_order, enabled)
     VALUES ${rows}
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       code = excluded.code,
       description = excluded.description,
       accent = excluded.accent,
       sort_order = excluded.sort_order`,
    ...params,
  );
}

function cardParams(card: Card, sortOrder: number): (string | number | null)[] {
  return [
    card.id,
    card.deckId,
    card.type,
    card.question,
    card.code ?? null,
    card.options === null ? null : JSON.stringify(card.options),
    JSON.stringify(card.answer),
    JSON.stringify({}),
    card.explain,
    JSON.stringify(card.tags),
    card.difficulty,
    sortOrder,
    'seed',
    null,
  ];
}

async function upsertCards(cards: Card[]): Promise<void> {
  const db = await getDatabase();
  const chunkSize = 50;
  for (let offset = 0; offset < cards.length; offset += chunkSize) {
    const chunk = cards.slice(offset, offset + chunkSize);
    const rows = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = chunk.flatMap((card, index) => cardParams(card, offset + index));
    await db.runAsync(
      `INSERT INTO cards (
        id, deck_id, type, question, code, options, answer, payload,
        explain, tags, difficulty, sort_order, source, verified_at
      ) VALUES ${rows}
      ON CONFLICT(id) DO UPDATE SET
        deck_id = excluded.deck_id,
        type = excluded.type,
        question = excluded.question,
        code = excluded.code,
        options = excluded.options,
        answer = excluded.answer,
        payload = excluded.payload,
        explain = excluded.explain,
        tags = excluded.tags,
        difficulty = excluded.difficulty,
        sort_order = excluded.sort_order`,
      ...params,
    );
  }
}

async function ensureReviewStates(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO review_states (card_id, due_at, status)
     SELECT id, ?, 'new' FROM cards
     WHERE id NOT IN (SELECT card_id FROM review_states)`,
    new Date().toISOString(),
  );
}

async function writeVersion(version: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('deck_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(version),
  );
}

export async function applyDeckBundle(bundle: DeckBundle): Promise<boolean> {
  if (bundle.version <= (await appliedVersion())) {
    return false;
  }
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await deleteRemoved(bundle.removed);
    await upsertDecks(bundle.decks);
    await upsertCards(bundle.cards);
    await ensureReviewStates();
    await writeVersion(bundle.version);
  });
  return true;
}
