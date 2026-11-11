import { jaccard, normalizeQuestion } from './similarity.mjs';
import { countChars } from './shared.mjs';

const BAD_OPTION = /以上都|都不对|都不正确|无法确定|全部正确|均正确/;
const VALID_TYPES = new Set(['single', 'multi', 'fill', 'judge']);

function optionAnswerIndex(card) {
  if (card.type === 'single') return card.answer?.index;
  if (card.type === 'judge') return card.answer?.value === true ? 0 : 1;
  return undefined;
}

function correctOptionText(card) {
  const index = optionAnswerIndex(card);
  return Number.isInteger(index) ? card.options?.[index] : undefined;
}

function checkStructure(card, errors) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    errors.push('卡片不是对象');
    return false;
  }
  if (!VALID_TYPES.has(card.type)) errors.push(`type 非法：${String(card.type)}`);
  if (typeof card.question !== 'string' || card.question.trim() === '') {
    errors.push('题干为空');
  }
  if (typeof card.explain !== 'string' || card.explain.trim() === '') {
    errors.push('解析为空');
  }
  if (
    !Array.isArray(card.tags) ||
    card.tags.length < 1 ||
    card.tags.length > 3 ||
    !card.tags.every((tag) => typeof tag === 'string')
  ) {
    errors.push('tags 必须为 1~3 个字符串');
  }
  if (![1, 2, 3].includes(card.difficulty)) {
    errors.push('difficulty 必须为 1~3');
  }
  if (card.type === 'single') {
    if (!Array.isArray(card.options) || card.options.length !== 4) {
      errors.push('single options 必须为 4 项');
    } else if (
      !Number.isInteger(card.answer?.index) ||
      card.answer.index < 0 ||
      card.answer.index >= card.options.length
    ) {
      errors.push('single answer.index 越界');
    }
  }
  if (card.type === 'multi') {
    if (!Array.isArray(card.options) || card.options.length < 3 || card.options.length > 5) {
      errors.push('multi options 必须为 3~5 项');
    }
    const indices = card.answer?.indices;
    if (!Array.isArray(indices) || indices.length < 2) {
      errors.push('multi answer.indices 至少 2 项');
    } else if (
      new Set(indices).size !== indices.length ||
      !indices.every(
        (value) =>
          Number.isInteger(value) && value >= 0 && value < (card.options?.length ?? 0),
      )
    ) {
      errors.push('multi answer.indices 重复或越界');
    }
  }
  if (card.type === 'fill') {
    if (card.options !== null) errors.push('fill options 必须为 null');
    if (
      !Array.isArray(card.answer?.accept) ||
      card.answer.accept.length === 0 ||
      !card.answer.accept.every((item) => typeof item === 'string' && item.length > 0)
    ) {
      errors.push('fill answer.accept 必须非空');
    }
  }
  if (card.type === 'judge') {
    if (card.options !== null) errors.push('judge options 必须为 null');
    if (typeof card.answer?.value !== 'boolean') {
      errors.push('judge answer.value 必须为 boolean');
    }
  }
  return true;
}

export function validateCard(card, context = {}) {
  const errors = [];
  const warnings = [];
  if (!checkStructure(card, errors)) {
    return { errors, warnings };
  }

  const questionLength = countChars(card.question) + countChars(card.code);
  if (questionLength < 8 || questionLength > (card.code ? 200 : 120)) {
    warnings.push('题干长度不在 8~120 字（含 code 可到 200）');
  }
  const explainLength = countChars(card.explain);
  const maximumExplain = card.difficulty === 3 ? 600 : 250;
  if (explainLength < 80 || explainLength > maximumExplain) {
    warnings.push(
      `解析长度 ${explainLength}，要求 80~${maximumExplain} 字${card.difficulty === 3 ? '（含紧凑扩展）' : ''}`,
    );
  }
  if (typeof card.explain === 'string') {
    if (card.explain.startsWith('这道题')) {
      warnings.push('解析不要以“这道题”开头');
    }
    if (/正确答案是|选[A-D]/.test(card.explain)) {
      warnings.push('解析含低信息量表述');
    }
  }

  if (Array.isArray(card.options)) {
    const normalized = card.options.map((option) => normalizeQuestion(option));
    if (new Set(normalized).size !== normalized.length) {
      errors.push('选项归一化后重复');
    }
    if (card.options.some((option) => BAD_OPTION.test(String(option)))) {
      errors.push('选项命中废选项黑名单');
    }
    const correct = correctOptionText(card);
    if (correct && card.options.length > 1) {
      const others = card.options.filter((option) => option !== correct);
      const average =
        others.reduce((sum, option) => sum + countChars(option), 0) /
        Math.max(1, others.length);
      if (countChars(correct) > average * 1.5) {
        warnings.push('正确项明显长于其他选项，存在长度泄露');
      }
    }
  }

  for (const existing of context.sameDeckCards ?? []) {
    if (
      existing &&
      existing.question &&
      existing.file !== context.file &&
      jaccard(card.question, existing.question) > 0.75
    ) {
      errors.push(`与同 deck 题目重复：${existing.question.slice(0, 24)}`);
    }
  }
  for (const existing of context.existingCards ?? []) {
    if (existing?.question && jaccard(card.question, existing.question) > 0.75) {
      errors.push(`与已有题库重复：${existing.question.slice(0, 24)}`);
    }
  }

  const synonymPairs = [
    ['复杂度', '时间复杂度'],
    ['神经网络', '神经网路'],
    ['子网掩码', '子网屏蔽码'],
  ];
  for (const tag of Array.isArray(card.tags) ? card.tags : []) {
    for (const [left, right] of synonymPairs) {
      if (
        (tag.includes(left) && context.globalTags?.has(right)) ||
        (tag.includes(right) && context.globalTags?.has(left))
      ) {
        warnings.push(`标签可能存在同义重复：${tag}`);
      }
    }
  }
  return { errors, warnings };
}

export function difficultyWarnings(cards) {
  const total = cards.length;
  if (total === 0) return [];
  const counts = [1, 2, 3].map(
    (difficulty) => cards.filter((card) => card.difficulty === difficulty).length,
  );
  const targets = [0.4, 0.4, 0.2];
  const warnings = [];
  counts.forEach((count, index) => {
    const actual = count / total;
    if (Math.abs(actual - targets[index]) > 0.2) {
      warnings.push(`难度 ${index + 1} 占比 ${Math.round(actual * 100)}%，偏离目标 40/40/20`);
    }
  });
  return warnings;
}

export function answerDistributionIssues(cards, { minimumSample = 16 } = {}) {
  const positions = cards
    .filter(
      (card) =>
        card?.type === 'single' &&
        Array.isArray(card.options) &&
        card.options.length === 4 &&
        Number.isInteger(card.answer?.index) &&
        card.answer.index >= 0 &&
        card.answer.index < 4,
    )
    .map((card) => card.answer.index);
  if (positions.length < minimumSample) {
    return [];
  }

  const counts = [0, 1, 2, 3].map(
    (position) => positions.filter((index) => index === position).length,
  );
  const labels = ['A', 'B', 'C', 'D'];
  const distribution = counts
    .map((count, index) => `${labels[index]}=${count}`)
    .join('，');
  const maximumAllowed = Math.floor(positions.length * 0.35);
  const minimumExpected = Math.max(1, Math.floor(positions.length * 0.1));
  const issues = [];
  if (Math.max(...counts) > maximumAllowed) {
    issues.push(`单选正确项位置过于集中（${distribution}）`);
  }
  if (counts.some((count) => count < minimumExpected)) {
    issues.push(`单选正确项位置覆盖不足（${distribution}）`);
  }
  return issues;
}
