import { readFile } from 'node:fs/promises';
import { jaccard } from './similarity.mjs';
import { mergeCardsIntoDeck } from './merge-core.mjs';
import { parseArgs, readDeckCards } from './shared.mjs';
import { validateCard } from './validate-core.mjs';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.positional[0];
const deckId = args.values.get('deck');
const dryRun = args.flags.has('dry-run');
if (!inputPath || !deckId) {
  console.error('用法：node tools/gen-cards/import.mjs <export.json> --deck ds [--dry-run]');
  process.exit(1);
}

const exported = JSON.parse(await readFile(inputPath, 'utf8'));
if (exported?.kind !== 'bytecard-export' || !Array.isArray(exported.cards)) {
  console.error('不是有效的 ByteCard 导出文件。');
  process.exit(1);
}
const existing = await readDeckCards(deckId);
const globalTags = new Set(existing.flatMap((card) => card.tags ?? []));
const cards = [];
const failures = [];
for (const input of exported.cards.filter((card) => card.deckId === deckId)) {
  const card = { ...input, source: undefined, verifiedAt: undefined };
  const report = validateCard(card, {
    sameDeckCards: [...existing, ...cards],
    existingCards: existing,
    globalTags,
  });
  if (report.errors.length > 0) {
    failures.push({ question: card.question, reasons: report.errors });
  } else {
    cards.push(card);
  }
}
const result = await mergeCardsIntoDeck({ deckId, cards, dryRun });
console.log(
  `${dryRun ? '[dry-run] ' : ''}导入 ${result.added} 张，跳过 ${result.skipped} 张（重复），${failures.length} 张校验失败`,
);
for (const failure of failures) {
  console.log(`- ${String(failure.question).slice(0, 36)}：${failure.reasons.join('；')}`);
}
const current = [];
for (const card of await readDeckCards(deckId)) {
  if (current.some((stem) => jaccard(stem, card.question) > 0.75)) {
    console.log(`警告：导入后仍发现重复题干 ${card.id}`);
  }
  current.push(card.question);
}
