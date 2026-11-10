import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  CARD_SYSTEM_PROMPT,
  buildCardGenerationPrompt,
} from './prompt-runtime.mjs';
import {
  findJsonFiles,
  outDir,
  parseArgs,
  readDeckCards,
  readJson,
  root,
} from './shared.mjs';

const args = parseArgs(process.argv.slice(2));
const deckFilter = args.values.get('deck');
const topicFilter = args.values.get('topic');
const countOverride = Number(args.values.get('count') ?? 0);
const force = args.flags.has('force');
const onlyCalc = args.flags.has('only-calc');
const concurrency = 3;

const syllabus = await readJson(join(root, 'tools/gen-cards/syllabus.json'));
const calcTopics = new Set(syllabus._calcTopics ?? []);
const apiKey =
  process.env.DEEPSEEK_API_KEY ?? process.env.BYTECARD_AI_KEY ?? '';
const baseUrl = (
  process.env.BYTECARD_AI_BASE_URL ?? 'https://api.deepseek.com'
).replace(/\/+$/, '');
const model = process.env.BYTECARD_AI_MODEL ?? 'deepseek-chat';

if (!apiKey) {
  console.error('缺少 DEEPSEEK_API_KEY（或 BYTECARD_AI_KEY），未发起请求。');
  process.exit(1);
}

function contentOf(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('接口未返回文本内容');
  }
  return content.trim();
}

function parseCardText(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error('返回内容不是合法 JSON');
  }
}

async function requestCard(topic, deckId, deckName, index, existingStems, examples) {
  const type = topic.types[index % topic.types.length] ?? 'single';
  const difficulties = topic.difficulty ?? [1, 2];
  const difficulty = difficulties[index % difficulties.length] ?? 2;
  const point = topic.points[index % topic.points.length] ?? topic.name;
  const body = {
    model,
    temperature: 0.85,
    max_tokens: 800,
    stream: false,
    messages: [
      { role: 'system', content: CARD_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildCardGenerationPrompt({
          deckId,
          deckName,
          topicId: topic.id,
          topicName: topic.name,
          point,
          type,
          difficulty,
          existingStems,
          examples,
        }),
      },
    ],
  };
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      return { card: parseCardText(contentOf(payload)), usage: payload.usage ?? null };
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('unreachable');
}

async function generatedStems(deckId) {
  const files = (await findJsonFiles(join(outDir, deckId))).filter(
    (path) => !path.includes(`${join('out', deckId, '_rejected')}`),
  );
  const stems = [];
  for (const file of files) {
    try {
      const card = await readJson(file);
      if (typeof card.question === 'string') {
        stems.push(card.question);
      }
    } catch {
      // 坏文件留给 validate 报告，不阻断其他生成。
    }
  }
  return stems;
}

async function writeResult(deckId, topicId, index, card, reason) {
  const directory =
    reason == null
      ? join(outDir, deckId)
      : join(outDir, deckId, '_rejected');
  await mkdir(directory, { recursive: true });
  const target =
    reason == null
      ? join(directory, `${topicId}-${index}.json`)
      : join(directory, `${topicId}-${index}-${reason}.json`);
  await writeFile(target, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  return target;
}

function topicSelected(deckId, topic) {
  if (deckFilter && deckId !== deckFilter) return false;
  if (topicFilter && topic.id !== topicFilter) return false;
  if (onlyCalc && !calcTopics.has(topic.id)) return false;
  return true;
}

const tasks = [];
for (const [deckId, deck] of Object.entries(syllabus.decks)) {
  const existing = await readDeckCards(deckId);
  const examples = existing
    .filter((card) => typeof card.explain === 'string' && card.explain.length >= 40)
    .slice(0, 2);
  for (const topic of deck.topics) {
    if (!topicSelected(deckId, topic)) continue;
    const count = countOverride > 0 ? countOverride : topic.target;
    for (let index = 1; index <= count; index += 1) {
      tasks.push({ deckId, deckName: deck.name, topic, index, examples });
    }
  }
}

if (tasks.length === 0) {
  console.error('筛选条件没有命中任何 topic。');
  process.exit(1);
}

const topicStats = new Map();
const usage = { input: 0, output: 0 };
let cursor = 0;

async function worker() {
  while (cursor < tasks.length) {
    const task = tasks[cursor];
    cursor += 1;
    const target = join(outDir, task.deckId, `${task.topic.id}-${task.index}.json`);
    if (!force) {
      try {
        await readFile(target);
        continue;
      } catch {
        // 文件不存在，继续生成。
      }
    }
    const stat = topicStats.get(task.topic.id) ?? {
      ok: 0,
      skip: 0,
      lowConf: 0,
      invalid: 0,
      failed: 0,
    };
    try {
      const stems = [
        ...(await generatedStems(task.deckId)),
        ...(await readDeckCards(task.deckId)).map((card) => card.question),
      ];
      const result = await requestCard(
        task.topic,
        task.deckId,
        task.deckName,
        task.index - 1,
        stems.filter((item) => typeof item === 'string'),
        task.examples,
      );
      if (result.usage) {
        usage.input += Number(result.usage.prompt_tokens ?? 0);
        usage.output += Number(result.usage.completion_tokens ?? 0);
      }
      const card = result.card;
      if (card?.skip === true) {
        stat.skip += 1;
        await writeResult(task.deckId, task.topic.id, task.index, card, 'skip');
      } else if (Number(card?.confidence ?? 0) < 0.7) {
        stat.lowConf += 1;
        await writeResult(
          task.deckId,
          task.topic.id,
          task.index,
          card,
          'low-confidence',
        );
      } else {
        stat.ok += 1;
        await writeResult(task.deckId, task.topic.id, task.index, card);
      }
    } catch (error) {
      stat.invalid += 1;
      await writeResult(
        task.deckId,
        task.topic.id,
        task.index,
        { error: error instanceof Error ? error.message : String(error) },
        'invalid',
      );
    }
    topicStats.set(task.topic.id, stat);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

for (const [topicId, stat] of topicStats) {
  const requested = tasks.filter((task) => task.topic.id === topicId).length;
  const done = stat.ok + stat.skip + stat.lowConf + stat.invalid;
  const topic = tasks.find((task) => task.topic.id === topicId)?.topic;
  console.log(
    `${topicId.padEnd(26)} ${done}/${requested}  ${stat.ok >= (topic?.target ?? 0) ? 'ok' : 'partial'}  (skip ${stat.skip}, lowConf ${stat.lowConf}, failed ${stat.invalid + stat.failed})`,
  );
}
console.log(
  `汇总：任务 ${tasks.length}，成功 ${[...topicStats.values()].reduce((sum, item) => sum + item.ok, 0)}，token 约 ${usage.input + usage.output}`,
);
