import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  findJsonFiles,
  outDir,
  parseArgs,
  readDeckCards,
  readJson,
  relativeToRoot,
  root,
} from './shared.mjs';
import {
  answerDistributionIssues,
  difficultyWarnings,
  validateCard,
} from './validate-core.mjs';

const args = parseArgs(process.argv.slice(2));
const deckFilter = args.values.get('deck');
const fix = args.flags.has('fix');
const syllabus = await readJson(join(root, 'tools/gen-cards/syllabus.json'));
const decks = deckFilter ? [deckFilter] : Object.keys(syllabus.decks);
const files = await findJsonFiles(outDir);
const existingByDeck = new Map();
const allExisting = [];
const globalTags = new Set();

for (const deckId of Object.keys(syllabus.decks)) {
  const cards = await readDeckCards(deckId);
  existingByDeck.set(deckId, cards);
  allExisting.push(...cards);
  for (const card of cards) {
    for (const tag of Array.isArray(card.tags) ? card.tags : []) {
      globalTags.add(tag);
    }
  }
}

const accepted = [];
const rejected = [];
const warnings = [];
const reasonCounts = new Map();

for (const file of files) {
  const deckId = relativeToRoot(file).split('/')[3];
  if (!decks.includes(deckId) || basename(file).startsWith('report')) continue;
  let raw = await readFile(file, 'utf8');
  let card;
  try {
    card = JSON.parse(raw);
  } catch {
    const body = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    try {
      card = JSON.parse(body);
      if (fix) {
        raw = `${JSON.stringify(card, null, 2)}\n`;
        await writeFile(file, raw, 'utf8');
      }
    } catch {
      const reason = 'JSON 无法解析';
      rejected.push({ file, id: basename(file), reason });
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      continue;
    }
  }
  if (card?.skip === true) continue;
  if (fix && (!Array.isArray(card.tags) || card.tags.length === 0)) {
    card.tags = [card.sourcePoint ?? '知识点'];
    await writeFile(file, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  }
  const existingWithoutSameId = allExisting.filter((item) => item.id !== card.id);
  const deckCards = accepted.filter((item) => item.deckId === deckId);
  const mergedDeckCards = existingWithoutSameId.filter((item) => item.deckId === deckId);
  const report = validateCard(card, {
    file,
    sameDeckCards: [...deckCards, ...mergedDeckCards],
    existingCards: existingWithoutSameId,
    globalTags,
  });
  const id = String(card?.id ?? basename(file, '.json'));
  if (report.errors.length > 0) {
    rejected.push({ file, id, reason: report.errors.join('；') });
    for (const reason of report.errors) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  } else {
    accepted.push({ ...card, deckId, file });
    for (const tag of card.tags) globalTags.add(tag);
  }
  warnings.push(
    ...report.warnings.map((warning) => ({
      file,
      id,
      warning,
    })),
  );
}

for (const deckId of decks) {
  const cardRows = accepted.filter((card) => card.deckId === deckId);
  for (const warning of difficultyWarnings(cardRows)) {
    warnings.push({ file: `assets/data/cards/${deckId}.json`, id: deckId, warning });
  }
  for (const topic of syllabus.decks[deckId]?.topics ?? []) {
    const topicCount = cardRows.filter(
      (card) => card.sourcePoint && topic.points.includes(card.sourcePoint),
    ).length;
    if (topicCount < topic.target) {
      warnings.push({
        file: `syllabus:${topic.id}`,
        id: topic.id,
        warning: `通过 ${topicCount}/${topic.target}，需要补跑`,
      });
    }
  }
}

const distributionIssues = answerDistributionIssues([...allExisting, ...accepted]);

await mkdir(outDir, { recursive: true });
const reasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
const report = [
  '# 题库生成校验报告',
  '',
  `生成时间：${new Date().toISOString()}`,
  `通过：${accepted.length}，拒绝：${rejected.length}，警告：${warnings.length}`,
  '',
  '## 拒绝原因分布',
  '',
  ...(reasons.length
    ? reasons.map(([reason, count]) => `- ${count} × ${reason}`)
    : ['- 无']),
  '',
  '## 被拒卡片',
  '',
  ...(rejected.length
    ? rejected.map((item) => `- \`${relativeToRoot(item.file)}\`：${item.reason}`)
    : ['- 无']),
  '',
  '## 需要人工看',
  '',
  ...(warnings.length
    ? warnings.map((item) => `- \`${relativeToRoot(item.file)}\`：${item.warning}`)
    : ['- 无']),
  '',
  '## 答案位置分布',
  '',
  ...(distributionIssues.length
    ? distributionIssues.map((issue) => `- ${issue}`)
    : ['- 通过']),
  '',
].join('\n');
await writeFile(join(outDir, 'report.md'), report, 'utf8');

const review = [
  '# 待人工抽查',
  '',
  `共 ${accepted.length} 张。每个 topic 至少抽 1 张，计算类全查。`,
  '',
  ...accepted.flatMap((card) => [
    `## ${card.deckId} · ${card.sourcePoint ?? '未标考点'}`,
    '',
    `**${card.question}**`,
    '',
    `答案：${JSON.stringify(card.answer)}`,
    '',
    `${card.explain}`,
    '',
  ]),
];
await writeFile(join(outDir, 'review-queue.md'), review.join('\n'), 'utf8');

console.log(
  `validate: 通过 ${accepted.length}，拒绝 ${rejected.length}，警告 ${warnings.length}`,
);
console.log(`report: ${relativeToRoot(join(outDir, 'report.md'))}`);
if (reasons.length > 0) {
  console.log(
    `top reasons: ${reasons.slice(0, 3).map(([reason, count]) => `${count}×${reason}`).join(' | ')}`,
  );
}
if (rejected.length > 0) process.exitCode = 1;
if (distributionIssues.length > 0) {
  for (const issue of distributionIssues) {
    console.error(`distribution: ${issue}`);
  }
  process.exitCode = 1;
}
