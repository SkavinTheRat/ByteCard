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

const minimumCards: Record<string, number> = {
  ds: 20,
  co: 18,
  os: 18,
  cn: 18,
  ai: 14,
  agent: 12,
  'llm-basic': 250,
  'llm-advanced': 250,
  'agent-basic': 250,
  'agent-advanced': 250,
};

function validateSingleAnswerDistribution(cards: unknown[]): string[] {
  const positions = cards
    .filter(
      (card): card is Record<string, unknown> =>
        isRecord(card) &&
        card.type === 'single' &&
        Array.isArray(card.options) &&
        card.options.length === 4 &&
        isRecord(card.answer) &&
        typeof card.answer.index === 'number' &&
        Number.isInteger(card.answer.index) &&
        card.answer.index >= 0 &&
        card.answer.index < 4,
    )
    .map((card) => (card.answer as { index: number }).index);
  if (positions.length < 16) {
    return [];
  }

  const counts = [0, 1, 2, 3].map(
    (position) => positions.filter((index) => index === position).length,
  );
  const labels = ['A', 'B', 'C', 'D'];
  const distribution = counts
    .map((count, index) => `${labels[index]}=${count}`)
    .join('，');
  const errors: string[] = [];
  const maximumAllowed = Math.floor(positions.length * 0.35);
  const minimumExpected = Math.max(1, Math.floor(positions.length * 0.1));

  if (Math.max(...counts) > maximumAllowed) {
    errors.push(`单选正确项位置过于集中（${distribution}）`);
  }
  if (counts.some((count) => count < minimumExpected)) {
    errors.push(`单选正确项位置覆盖不足（${distribution}）`);
  }
  return errors;
}

export function validateDecks(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.decks) || !Array.isArray(input.cards)) {
    return ['题库结构必须包含 decks 和 cards 数组'];
  }
  const decks = input.decks.filter(isRecord);
  const deckIds = new Set(
    decks.map((deck) => deck.id).filter((id): id is string => typeof id === 'string'),
  );
  const errors: string[] = [];
  const requiredDeckCount = Object.keys(minimumCards).length;
  if (decks.length !== requiredDeckCount || deckIds.size !== requiredDeckCount) {
    errors.push(`必须包含 ${requiredDeckCount} 个唯一学科包`);
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

  for (const [deckId, expected] of Object.entries(minimumCards)) {
    const actual = cards.filter(
      (card) => isRecord(card) && card.deckId === deckId,
    ).length;
    if (actual < expected) {
      errors.push(`${deckId}: 至少应有 ${expected} 张，实际 ${actual} 张`);
    }
  }
  for (const deckId of ['llm-basic', 'llm-advanced', 'agent-basic', 'agent-advanced']) {
    const cardsInDeck = cards.filter(
      (card) => isRecord(card) && card.deckId === deckId,
    );
    const total = cardsInDeck.length;
    if (total < 250 || total > 500 || total % 5 !== 0) {
      errors.push(`${deckId}: 扩充卡数应在 250~500 且为 5 的倍数，实际 ${total}`);
      continue;
    }
    const single = cardsInDeck.filter(
      (card) => isRecord(card) && card.type === 'single',
    ).length;
    const multi = cardsInDeck.filter(
      (card) => isRecord(card) && card.type === 'multi',
    ).length;
    const judge = cardsInDeck.filter(
      (card) => isRecord(card) && card.type === 'judge',
    ).length;
    if (single !== total * 0.4 || multi !== total * 0.4 || judge !== total * 0.2) {
      errors.push(`${deckId}: 题型必须保持 single 40%、multi 40%、judge 20%`);
    }
    const first = cardsInDeck.filter(
      (card) => isRecord(card) && Number(card.difficulty) === 1,
    ).length;
    const second = cardsInDeck.filter(
      (card) => isRecord(card) && Number(card.difficulty) === 2,
    ).length;
    const third = cardsInDeck.filter(
      (card) => isRecord(card) && Number(card.difficulty) === 3,
    ).length;
    if (first !== total * 0.4 || second !== total * 0.4 || third !== total * 0.2) {
      errors.push(`${deckId}: 难度必须保持 40/40/20`);
    }
  }
  const hard = cards.filter(
    (card) => isRecord(card) && card.difficulty === 3,
  ).length;
  if (hard < 15) {
    errors.push(`难度 3 的卡片至少应有 15 张，实际 ${hard} 张`);
  }
  errors.push(...validateSingleAnswerDistribution(cards));
  return errors;
}
