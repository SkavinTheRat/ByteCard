import { join } from 'node:path';
import { findJsonFiles, outDir, parseArgs, readDeckCards, readJson, root } from './shared.mjs';
import { mergeCardsIntoDeck } from './merge-core.mjs';
import { validateCard } from './validate-core.mjs';

const args = parseArgs(process.argv.slice(2));
const deckId = args.values.get('deck');
const dryRun = args.flags.has('dry-run');
if (!deckId) {
  console.error('用法：node tools/gen-cards/merge.mjs --deck ds [--dry-run] [--remove id...]');
  process.exit(1);
}

const removeIndex = process.argv.indexOf('--remove');
const removeIds = [];
if (removeIndex >= 0) {
  for (const token of process.argv.slice(removeIndex + 1)) {
    if (token.startsWith('--')) break;
    removeIds.push(token);
  }
}

const files = (await findJsonFiles(join(outDir, deckId))).filter(
  (path) => !path.includes(`${join('out', deckId, '_rejected')}`),
);
const existing = await readDeckCards(deckId);
const globalTags = new Set(existing.flatMap((card) => card.tags ?? []));
const cards = [];
let invalid = 0;
for (const file of files) {
  try {
    const card = await readJson(file);
    const report = validateCard(card, {
      file,
      sameDeckCards: [...existing, ...cards],
      existingCards: existing,
      globalTags,
    });
    if (report.errors.length === 0) {
      cards.push({ ...card, sourceFile: file });
      for (const tag of card.tags ?? []) globalTags.add(tag);
    } else {
      invalid += 1;
    }
  } catch {
    invalid += 1;
  }
}
const result = await mergeCardsIntoDeck({
  deckId,
  cards,
  removeIds,
  dryRun,
});
console.log(
  `${dryRun ? '[dry-run] ' : ''}将新增 ${result.added} 张，跳过 ${result.skipped + invalid} 张重复/无效，移除 ${result.removed} 张，版本 → v${result.version}`,
);
