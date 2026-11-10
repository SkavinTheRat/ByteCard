import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const syllabus = JSON.parse(
  await readFile(join(root, 'tools/gen-cards/syllabus.json'), 'utf8'),
);
const topics = [];
for (const [deckId, deck] of Object.entries(syllabus.decks)) {
  for (const topic of deck.topics) {
    topics.push({
      id: topic.id,
      deckId,
      name: topic.name,
      points: topic.points,
    });
  }
}
const output = { version: 1, topics };
await writeFile(
  join(root, 'assets/data/topics.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);
const targets = Object.values(syllabus.decks).flatMap((deck) =>
  deck.topics.map((topic) => topic.target),
);
console.log(
  `topics=${topics.length} target=${targets.reduce((sum, value) => sum + value, 0)}`,
);
