import type { JudgeCard } from '@/types';
import { zh } from '@/i18n/zh';
import type { CardDefinition, GradeResult, RawAnswer } from '../../registry';
import { JudgeAnswerView } from './AnswerView';

function standardAnswer(card: JudgeCard): string {
  return card.answer.value ? zh.judge.true : zh.judge.false;
}

function validate(card: unknown): string[] {
  if (typeof card !== 'object' || card === null) {
    return ['判断卡不是对象'];
  }
  const candidate = card as { options?: unknown; answer?: unknown };
  const errors: string[] = [];
  if (candidate.options !== null) {
    errors.push('判断 options 必须为 null');
  }
  const answer = candidate.answer;
  const value =
    typeof answer === 'object' && answer !== null
      ? (answer as { value?: unknown }).value
      : undefined;
  if (typeof value !== 'boolean') {
    errors.push('判断 answer.value 必须为 boolean');
  }
  return errors;
}

export const judgeDefinition: CardDefinition<JudgeCard> = {
  type: 'judge',
  label: '判断',
  schemaVersion: 1,
  validate,
  AnswerView: JudgeAnswerView,
  answerText: standardAnswer,
  grade({ card, raw, elapsedMs }): GradeResult {
    const picked =
      raw.kind === 'index' ? (raw.value === 0 ? true : raw.value === 1 ? false : null) : null;
    const correct = picked === card.answer.value;
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
