import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expansionFacts } from './ai-expansion-facts.mjs';
import { buildExpansionDeck } from './expansion-generator-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const syllabus = JSON.parse(
  await readFile(join(root, 'tools/gen-cards/syllabus.json'), 'utf8'),
);
const outDir = join(root, 'tools/gen-cards/out');
const manifestPath = join(root, 'tools/gen-cards/manifests/ai-expansion.json');
const targetPerDeck = Number(syllabus._expansion.targetCardsPerDeck ?? 250);
const maxPerDeck = Number(syllabus._expansion.capacityPerDeck ?? 500);
const sourceRegistry = syllabus._expansion.sources;
const batchSize = 25;
const deckIds = ['llm-basic', 'llm-advanced', 'agent-basic', 'agent-advanced'];
const manifestCards = [];
const summary = {};

for (const deckId of deckIds) {
  const deck = syllabus.decks[deckId];
  const grouped = expansionFacts[deckId];
  if (!deck || !grouped) throw new Error(`syllabus 或 facts 缺少 ${deckId}`);
  const result = buildExpansionDeck({ deckId, deck, grouped, targetPerDeck });

  for (const item of result.cards) {
    const card = item.card;
    const batch = String(Math.ceil(card.sortOrder / batchSize)).padStart(2, '0');
    const path = join(outDir, deckId, `batch-${batch}`, `${card.id}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
    manifestCards.push({
      id: card.id,
      deckId,
      topicId: item.topicId,
      sourceRefs: item.sourceRefs,
      sources: item.sourceRefs.map((id) => ({ id, ...sourceRegistry[id] })),
      reviewStatus: 'pending',
    });
  }

  summary[deckId] = {
    cards: result.cards.length,
    facts: result.factCount,
    batches: result.cards.length / batchSize,
  };
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      deckIds,
      targetPerDeck,
      maxPerDeck,
      batchSize,
      sources: sourceRegistry,
      cards: manifestCards,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(JSON.stringify({ targetPerDeck, totalCards: manifestCards.length, summary }, null, 2));
