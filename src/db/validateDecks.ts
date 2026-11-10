import { getCardDef } from '@/cards';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateCard(card: unknown): string[] {
  if (!isRecord(card)) {
    return ['卡片不是对象'];
  }
  const id = typeof card.id === 'string' ? card.id : 'unknown';
  const errors: string[] = [];
  if (typeof card.id !== 'string' || card.id.length === 0) {
    errors.push('卡片缺少 id');
  }
  if (typeof card.deckId !== 'string') {
    errors.push(`${id}: 缺少 deckId`);
  }
  if (typeof card.question !== 'string' || card.question.length === 0) {
    errors.push(`${id}: 缺少题干`);
  }
  if (typeof card.type !== 'string') {
    return [...errors, `${id}: 缺少题型 type`];
  }
  if (typeof card.explain !== 'string' || card.explain.length < 40) {
    errors.push(`${id}: 解析少于 40 字`);
  }
  if (
    !Array.isArray(card.tags) ||
    card.tags.length === 0 ||
    !card.tags.every((tag) => typeof tag === 'string')
  ) {
    errors.push(`${id}: tags 不能为空`);
  }
  if (![1, 2, 3].includes(Number(card.difficulty))) {
    errors.push(`${id}: difficulty 必须为 1~3`);
  }

  const definition = getCardDef(card.type);
  if (!definition) {
    errors.push(`${id}: 未知识别题型 ${String(card.type)}`);
  } else {
    errors.push(...definition.validate(card).map((error) => `${id}: ${error}`));
  }
  return errors;
}

const quota: Record<string, number> = {
  ds: 20,
  co: 18,
  os: 18,
  cn: 18,
  ai: 14,
  agent: 12,
};

export function validateDecks(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.decks) || !Array.isArray(input.cards)) {
    return ['题库结构必须包含 decks 和 cards 数组'];
  }
  const decks = input.decks.filter(isRecord);
  const deckIds = new Set(
    decks.map((deck) => deck.id).filter((id): id is string => typeof id === 'string'),
  );
  const errors: string[] = [];
  if (decks.length !== 6 || deckIds.size !== 6) {
    errors.push('必须包含 6 个唯一学科包');
  }
  for (const deck of decks) {
    if (
      typeof deck.name !== 'string' ||
      typeof deck.code !== 'string' ||
      typeof deck.accent !== 'string' ||
      typeof deck.sortOrder !== 'number'
    ) {
      errors.push(`${String(deck.id ?? 'unknown')}: 学科包字段不完整`);
    }
  }

  const cards = input.cards;
  const cardIds = cards
    .filter(isRecord)
    .map((card) => card.id)
    .filter((id): id is string => typeof id === 'string');
  if (new Set(cardIds).size !== cardIds.length) {
    errors.push('卡片 id 存在重复');
  }

  for (const card of cards) {
    errors.push(...validateCard(card));
    if (isRecord(card) && typeof card.deckId === 'string' && !deckIds.has(card.deckId)) {
      errors.push(`${String(card.id)}: deckId 不存在`);
    }
  }

  for (const [deckId, expected] of Object.entries(quota)) {
    const actual = cards.filter(
      (card) => isRecord(card) && card.deckId === deckId,
    ).length;
    if (actual !== expected) {
      errors.push(`${deckId}: 应有 ${expected} 张，实际 ${actual} 张`);
    }
  }
  const hard = cards.filter(
    (card) => isRecord(card) && card.difficulty === 3,
  ).length;
  if (hard < 15 || hard > 25) {
    errors.push(`难度 3 的卡片应有约 20 张，实际 ${hard} 张`);
  }
  return errors;
}
