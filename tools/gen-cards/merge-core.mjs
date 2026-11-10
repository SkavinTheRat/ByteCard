import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { jaccard } from './similarity.mjs';
import { decksDir, readJson, root } from './shared.mjs';

function nextId(deckId, cards) {
  let maximum = 0;
  for (const card of cards) {
    const match = String(card.id ?? '').match(new RegExp(`^${deckId}-(\\d+)$`));
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  return () => {
    maximum += 1;
    return `${deckId}-${String(maximum).padStart(3, '0')}`;
  };
}

export function cleanCard(card, deckId) {
  const result = { ...card, deckId };
  delete result.id;
  delete result.confidence;
  delete result.skip;
  delete result.reason;
  delete result.error;
  delete result.usage;
  delete result.verified_at;
  delete result.verifiedAt;
  delete result.source;
  delete result.sortOrder;
  delete result.sourceFile;
  return result;
}

export async function mergeCardsIntoDeck({
  deckId,
  cards,
  removeIds = [],
  dryRun = false,
}) {
  const cardsPath = join(decksDir, `${deckId}.json`);
  const deckData = await readJson(cardsPath);
  const decksPath = join(root, 'assets/data/decks.json');
  const decksData = await readJson(decksPath);
  const existing = Array.isArray(deckData.cards) ? deckData.cards : [];
  const existingStems = existing.map((card) => card.question);
  const accepted = [];
  let skipped = 0;
  for (const input of cards) {
    const question = String(input?.question ?? '');
    if (
      !question ||
      existingStems.some((stem) => jaccard(stem, question) > 0.75) ||
      accepted.some((card) => jaccard(card.question, question) > 0.75)
    ) {
      skipped += 1;
      continue;
    }
    accepted.push(cleanCard(input, deckId));
  }
  const removeSet = new Set(removeIds);
  const removedExisting = existing.filter((card) => removeSet.has(card.id)).length;
  const makeId = nextId(deckId, existing);
  const addedCards = accepted.map((card) => ({ id: makeId(), ...card }));
  const nextCards = existing
    .filter((card) => !removeSet.has(card.id))
    .concat(addedCards)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const removed = new Set([
    ...(Array.isArray(decksData.removed) ? decksData.removed : []),
    ...removeIds,
  ]);
  const nextDecks = {
    ...decksData,
    version: Number(decksData.version ?? 0) + (accepted.length || removedExisting ? 1 : 0),
    removed: [...removed],
  };
  if (!dryRun && (accepted.length > 0 || removedExisting > 0)) {
    await writeFile(
      cardsPath,
      `${JSON.stringify({ cards: nextCards }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(decksPath, `${JSON.stringify(nextDecks, null, 2)}\n`, 'utf8');
  }
  return {
    added: accepted.length,
    skipped,
    removed: removedExisting,
    version: nextDecks.version,
  };
}

export async function readAllDeckCards() {
  const decks = await readJson(join(root, 'assets/data/decks.json'));
  const groups = [];
  for (const deck of decks.decks) {
    const data = await readJson(join(decksDir, `${deck.id}.json`));
    groups.push(...data.cards);
  }
  return groups;
}
