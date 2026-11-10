import { getCardDef } from '@/cards';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateRemoteBundle(input: unknown): string[] {
  if (!isRecord(input)) return ['题库不是对象'];
  const errors: string[] = [];
  if (!Number.isInteger(input.version) || Number(input.version) <= 0) {
    errors.push('version 必须为正整数');
  }
  if (!Array.isArray(input.decks)) errors.push('decks 必须为数组');
  if (!Array.isArray(input.cards)) errors.push('cards 必须为数组');
  if (input.removed !== undefined && !Array.isArray(input.removed)) {
    errors.push('removed 必须为数组');
  }
  if (errors.length > 0) return errors;
  const deckIds = new Set<string>();
  for (const deck of input.decks as unknown[]) {
    if (
      !isRecord(deck) ||
      typeof deck.id !== 'string' ||
      typeof deck.name !== 'string' ||
      typeof deck.code !== 'string' ||
      typeof deck.accent !== 'string' ||
      typeof deck.sortOrder !== 'number'
    ) {
      errors.push('学科包结构无效');
      continue;
    }
    if (deckIds.has(deck.id)) errors.push(`学科包重复：${deck.id}`);
    deckIds.add(deck.id);
  }
  const cardIds = new Set<string>();
  for (const card of input.cards as unknown[]) {
    if (!isRecord(card) || typeof card.id !== 'string' || typeof card.type !== 'string') {
      errors.push('卡片结构无效');
      continue;
    }
    if (cardIds.has(card.id)) errors.push(`卡片 id 重复：${card.id}`);
    cardIds.add(card.id);
    if (
      typeof card.question !== 'string' ||
      typeof card.explain !== 'string' ||
      !Array.isArray(card.tags) ||
      ![1, 2, 3].includes(Number(card.difficulty))
    ) {
      errors.push(`${card.id}: 卡片基础字段无效`);
    }
    if (typeof card.deckId !== 'string' || !deckIds.has(card.deckId)) {
      errors.push(`${card.id}: deckId 不存在`);
    }
    const definition = getCardDef(card.type);
    if (!definition) {
      errors.push(`${card.id}: 未知题型 ${card.type}`);
    } else {
      errors.push(...definition.validate(card).map((error) => `${card.id}: ${error}`));
    }
  }
  return errors;
}
