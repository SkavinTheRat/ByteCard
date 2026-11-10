import type { SingleCard } from '@/types';
import type { CardDefinition, GradeResult, RawAnswer } from '../../registry';
import { SingleAnswerView } from './AnswerView';

function standardAnswer(card: SingleCard): string {
  return card.options[card.answer.index] ?? '';
}

function validate(card: unknown): string[] {
  if (typeof card !== 'object' || card === null) {
    return ['单选卡不是对象'];
  }
  const candidate = card as { options?: unknown; answer?: unknown };
  if (
    !Array.isArray(candidate.options) ||
    candidate.options.length < 2 ||
    candidate.options.length > 4 ||
    !candidate.options.every((item) => typeof item === 'string')
  ) {
    return ['单选 options 必须为 2~4 个字符串'];
  }
  const answer = candidate.answer;
  const index =
    typeof answer === 'object' && answer !== null
      ? (answer as { index?: unknown }).index
      : undefined;
  if (
    typeof index !== 'number' ||
    index < 0 ||
    index >= candidate.options.length
  ) {
    return ['单选 answer.index 越界'];
  }
  return [];
}

export const singleDefinition: CardDefinition<SingleCard> = {
  type: 'single',
  label: '单选',
  schemaVersion: 1,
  validate,
  AnswerView: SingleAnswerView,
  grade({ card, raw, elapsedMs }): GradeResult {
    const correct = raw.kind === 'index' && raw.value === card.answer.index;
    if (!correct) {
      return { isCorrect: false, quality: 0, correctText: standardAnswer(card) };
    }
    return {
      isCorrect: true,
      quality: elapsedMs <= 15_000 ? 5 : 4,
      correctText: standardAnswer(card),
      matchedBy: 'exact',
    };
  },
  preview(card) {
    return { title: card.question, subtitle: standardAnswer(card) };
  },
};

export type { RawAnswer };
