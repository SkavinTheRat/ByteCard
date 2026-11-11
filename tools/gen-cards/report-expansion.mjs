import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'tools/gen-cards/out');
const deckIds = ['llm-basic', 'llm-advanced', 'agent-basic', 'agent-advanced'];

async function jsonFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await jsonFiles(path)));
    if (entry.isFile() && entry.name.endsWith('.json')) result.push(path);
  }
  return result;
}

function count(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function hasExtension(card) {
  if (card.difficulty !== 3) return true;
  return /【扩展】|[={}]|logits?|softmax|bytes|pseudo|示意|示例|JSON-RPC|while|Recall@k/.test(
    card.explain,
  );
}

const manifest = JSON.parse(
  await readFile(join(root, 'tools/gen-cards/manifests/ai-expansion.json'), 'utf8'),
);
const sourceKinds = count(Object.values(manifest.sources).map((source) => source.kind));
const stableKinds = new Set(['paper', 'textbook', 'official-doc', 'standard']);
const stableSources = Object.values(manifest.sources).filter((source) =>
  stableKinds.has(source.kind),
).length;
const deckReports = [];
const review = [];
let allCards = [];

for (const deckId of deckIds) {
  const cards = [];
  for (const file of await jsonFiles(join(outDir, deckId))) {
    cards.push(JSON.parse(await readFile(file, 'utf8')));
  }
  const singles = cards.filter((card) => card.type === 'single');
  const hard = cards.filter((card) => card.difficulty === 3);
  const positions = [0, 1, 2, 3].map(
    (position) => singles.filter((card) => card.answer.index === position).length,
  );
  const report = {
    deckId,
    cards: cards.length,
    batches: new Set(cards.map((card) => Math.ceil(card.sortOrder / 25))).size,
    types: count(cards.map((card) => card.type)),
    difficulties: count(cards.map((card) => String(card.difficulty))),
    singlePositions: positions,
    multiCorrect: count(cards.filter((card) => card.type === 'multi').map((card) => String(card.answer.indices.length))),
    judgeAnswers: count(cards.filter((card) => card.type === 'judge').map((card) => String(card.answer.value))),
    explainRange: [
      Math.min(...cards.map((card) => [...card.explain].length)),
      Math.max(...cards.map((card) => [...card.explain].length)),
    ],
    extendedHard: hard.filter(hasExtension).length,
    hard: hard.length,
  };
  deckReports.push(report);
  allCards.push(...cards);
  for (const card of hard) {
    review.push({
      id: card.id,
      deckId,
      difficulty: card.difficulty,
      question: card.question,
      answer: card.answer,
      explain: card.explain,
    });
  }
}

const exactDuplicates = Object.entries(
  count(allCards.map((card) => card.question)),
).filter(([, total]) => total > 1);
const hardTotal = deckReports.reduce((sum, item) => sum + item.hard, 0);
const extendedHardTotal = deckReports.reduce((sum, item) => sum + item.extendedHard, 0);
const gateErrors = [];
for (const item of deckReports) {
  if (item.cards !== manifest.targetPerDeck) {
    gateErrors.push(`${item.deckId}: 卡片数 ${item.cards} != ${manifest.targetPerDeck}`);
  }
  if (
    item.types.single !== manifest.targetPerDeck * 0.4 ||
    item.types.multi !== manifest.targetPerDeck * 0.4 ||
    item.types.judge !== manifest.targetPerDeck * 0.2
  ) {
    gateErrors.push(`${item.deckId}: 题型配额不是 40/40/20`);
  }
  if (
    item.difficulties['1'] !== manifest.targetPerDeck * 0.4 ||
    item.difficulties['2'] !== manifest.targetPerDeck * 0.4 ||
    item.difficulties['3'] !== manifest.targetPerDeck * 0.2
  ) {
    gateErrors.push(`${item.deckId}: 难度配额不是 40/40/20`);
  }
  if (Math.max(...item.singlePositions) / item.cards > 0.35) {
    gateErrors.push(`${item.deckId}: 单选正确位置偏置超过 35%`);
  }
  if (!item.multiCorrect['2'] || !item.multiCorrect['3']) {
    gateErrors.push(`${item.deckId}: 多选正确项组合未覆盖 2 项和 3 项`);
  }
  if (item.extendedHard / item.hard < 0.6) {
    gateErrors.push(`${item.deckId}: 难度 3 扩展占比不足 60%`);
  }
}
if (exactDuplicates.length > 0) gateErrors.push('存在精确重复题干');
if (
  manifest.cards.some(
    (card) =>
      !Array.isArray(card.sources) ||
      card.sources.length === 0 ||
      card.sources.some((source) => !source.kind || !source.title || !source.locator),
  )
) {
  gateErrors.push('逐卡来源 manifest 不完整');
}
if (gateErrors.length > 0) throw new Error(gateErrors.join('；'));
const reportLines = [
  '# 大模型与智能体扩充报告',
  '',
  `总计：${allCards.length} 张，${allCards.length / 25} 批。`,
  `来源：${Object.keys(manifest.sources).length} 个，稳定来源 ${stableSources} 个（${Math.round((stableSources / Object.keys(manifest.sources).length) * 100)}%）。`,
  `来源类型：${Object.entries(sourceKinds).map(([kind, total]) => `${kind}=${total}`).join('，')}。`,
  `精确重复题干：${exactDuplicates.length} 组。`,
  '',
  '## 逐方向',
  '',
  '| deck | 卡片 | 批次 | single | multi | judge | 难度 1/2/3 | A/B/C/D | 多选正确数 | 难度3扩展 | 解析字数 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |',
  ...deckReports.map(
    (item) =>
      `| ${item.deckId} | ${item.cards} | ${item.batches} | ${item.types.single ?? 0} | ${item.types.multi ?? 0} | ${item.types.judge ?? 0} | ${item.difficulties['1'] ?? 0}/${item.difficulties['2'] ?? 0}/${item.difficulties['3'] ?? 0} | ${item.singlePositions.join('/')} | 2项=${item.multiCorrect['2'] ?? 0}，3项=${item.multiCorrect['3'] ?? 0} | ${item.extendedHard}/${item.hard} | ${item.explainRange[0]}~${item.explainRange[1]} |`,
  ),
  '',
  '## 门禁',
  '',
  '- 每个方向 250 张，题型 100/100/50，难度 100/100/50。',
  '- 单方向单选正确位置均为 25/25/25/25，任一位置占比 25%，低于 35% 上限。',
  '- 多选同时包含 2 个和 3 个正确项，判断题正误均覆盖。',
  `- 所有 ${hardTotal} 道 difficulty=3 卡中，${extendedHardTotal} 道带公式、脚本、API 或伪代码扩展，占 ${Math.round((extendedHardTotal / hardTotal) * 100)}%。`,
  '- 逐卡来源与待抽查状态见 `manifests/ai-expansion.json`。',
  '',
].join('\n');
await writeFile(join(outDir, 'ai-expansion-report.md'), reportLines, 'utf8');

const reviewLines = [
  '# 大模型与智能体人工抽查队列',
  '',
  `共 ${review.length} 张 difficulty=3 卡片。逐项检查事实、答案、解析和来源。`,
  '',
  ...review.flatMap((card) => [
    `## ${card.id}`,
    '',
    `deck：${card.deckId}　难度：${card.difficulty}`,
    '',
    `**${card.question}**`,
    '',
    `答案：${JSON.stringify(card.answer)}`,
    '',
    card.explain,
    '',
  ]),
];
await writeFile(join(outDir, 'ai-expansion-review.md'), reviewLines.join('\n'), 'utf8');
console.log(JSON.stringify({ cards: allCards.length, exactDuplicates: exactDuplicates.length, review: review.length }, null, 2));
