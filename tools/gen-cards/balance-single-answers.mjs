import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decksDir, readJson, root } from './shared.mjs';

const metadata = await readJson(join(root, 'assets/data/decks.json'));
let singleCursor = 0;
let changed = 0;
const distribution = [0, 0, 0, 0];

for (const deck of metadata.decks) {
  const path = join(decksDir, `${deck.id}.json`);
  const deckData = JSON.parse(await readFile(path, 'utf8'));
  let fileChanged = false;
  const cards = deckData.cards.map((card) => {
    if (
      card.type !== 'single' ||
      !Array.isArray(card.options) ||
      !Number.isInteger(card.answer?.index) ||
      card.answer.index < 0 ||
      card.answer.index >= card.options.length
    ) {
      return card;
    }

    const target = singleCursor % card.options.length;
    singleCursor += 1;
    const nextCard =
      target === card.answer.index
        ? card
        : (() => {
            const options = [...card.options];
            [options[target], options[card.answer.index]] = [
              options[card.answer.index],
              options[target],
            ];
            return { ...card, options, answer: { index: target } };
          })();
    if (target < distribution.length) {
      distribution[target] += 1;
    }
    if (nextCard !== card) {
      changed += 1;
      fileChanged = true;
    }
    return nextCard;
  });

  if (fileChanged) {
    await writeFile(
      path,
      `${JSON.stringify({ ...deckData, cards }, null, 2)}\n`,
      'utf8',
    );
  }
}

console.log(
  `single 位置均衡完成：${singleCursor} 张，调整 ${changed} 张，分布 A=${distribution[0]} B=${distribution[1]} C=${distribution[2]} D=${distribution[3]}`,
);
