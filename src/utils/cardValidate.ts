import { getCardDef } from '@/cards';
import type { Card, CardBase } from '@/types';

type DraftBase = Omit<CardBase, 'id' | 'source' | 'verifiedAt' | 'sortOrder'>;
export type DraftCard = DraftBase & {
  aiConfidence: number;
  sourcePoint: string;
} & (
  | { type: 'single'; options: string[]; answer: { index: number } }
  | { type: 'multi'; options: string[]; answer: { indices: number[] } }
  | { type: 'fill'; options: null; answer: { accept: string[]; hint?: string } }
  | { type: 'judge'; options: null; answer: { value: boolean } }
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDraftCard(value: unknown): {
  card: DraftCard | null;
  errors: string[];
} {
  if (!isRecord(value)) {
    return { card: null, errors: ['返回内容不是对象'] };
  }
  const errors: string[] = [];
  if (typeof value.type !== 'string') errors.push('缺少 type');
  if (typeof value.question !== 'string' || value.question.trim().length < 8) {
    errors.push('题干少于 8 个字符');
  }
  if (typeof value.explain !== 'string' || value.explain.trim().length < 40) {
    errors.push('解析少于 40 个字符');
  }
  if (
    !Array.isArray(value.tags) ||
    value.tags.length < 1 ||
    value.tags.length > 3 ||
    !value.tags.every((tag) => typeof tag === 'string')
  ) {
    errors.push('tags 必须为 1~3 个字符串');
  }
  if (![1, 2, 3].includes(Number(value.difficulty))) {
    errors.push('difficulty 必须为 1~3');
  }
  if (typeof value.aiConfidence !== 'number' || value.aiConfidence < 0.7) {
    errors.push('confidence 低于阈值');
  }
  const definition = typeof value.type === 'string' ? getCardDef(value.type) : undefined;
  if (!definition) {
    errors.push('题型未注册');
  } else {
    errors.push(...definition.validate(value));
  }
  if (errors.length > 0) {
    return { card: null, errors };
  }
  return {
    card: {
      deckId: String(value.deckId ?? ''),
      type: value.type as DraftCard['type'],
      question: String(value.question),
      code: typeof value.code === 'string' ? value.code : undefined,
      options: value.options as DraftCard['options'],
      answer: value.answer as DraftCard['answer'],
      payload: isRecord(value.payload) ? value.payload : {},
      explain: String(value.explain),
      tags: value.tags as string[],
      difficulty: Number(value.difficulty) as 1 | 2 | 3,
      aiConfidence: Number(value.aiConfidence),
      sourcePoint: String(value.sourcePoint ?? ''),
    } as DraftCard,
    errors: [],
  };
}

export function draftToCard(draft: DraftCard, id: string): Card {
  return {
    ...draft,
    id,
    source: 'ai',
    sortOrder: 0,
  } as Card;
}
