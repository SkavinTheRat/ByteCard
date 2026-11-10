import type { MultiCard } from '@/types';
import { zh } from '@/i18n/zh';
import type { CardDefinition, GradeResult, RawAnswer } from '../../registry';
import { MultiAnswerView } from './AnswerView';

function labels(card: MultiCard, indices: number[]): string {
  return indices
    .map((index) => card.options[index])
    .filter((value): value is string => typeof value === 'string')
    .join('；');
}

function validate(card: unknown): string[] {
  if (typeof card !== 'object' || card === null) {
    return ['多选卡不是对象'];
  }
  const candidate = card as { options?: unknown; answer?: unknown };
  const options = candidate.options;
  if (
    !Array.isArray(options) ||
    options.length < 3 ||
    options.length > 5 ||
    !options.every((item) => typeof item === 'string')
  ) {
    return ['多选 options 必须为 3~5 个字符串'];
  }
  const answer = candidate.answer;
  const indices =
    typeof answer === 'object' && answer !== null
      ? (answer as { indices?: unknown }).indices
      : undefined;
  if (!Array.isArray(indices) || indices.length < 2) {
    return ['多选 answer.indices 至少 2 项'];
  }
  if (new Set(indices).size !== indices.length) {
    return ['多选 answer.indices 不可重复'];
  }
  if (
    !indices.every((item) => typeof item === 'number') ||
    indices.some((index) => index < 0 || index >= options.length)
  ) {
    return ['多选 answer.indices 越界或类型错误'];
  }
  return [];
}

export const multiDefinition: CardDefinition<MultiCard> = {
  type: 'multi',
  label: '多选',
  schemaVersion: 1,
  validate,
  AnswerView: MultiAnswerView,
  grade({ card, raw, elapsedMs }): GradeResult {
    const selected =
      raw.kind === 'indices' ? [...new Set(raw.value)].sort() : [];
    const correct = [...card.answer.indices].sort();
    const exact =
      selected.length === correct.length &&
      selected.every((value, index) => value === correct[index]);
    const correctText = labels(card, correct);
    if (exact) {
      return {
        isCorrect: true,
        quality: elapsedMs <= 15_000 ? 5 : 4,
        correctText,
        matchedBy: 'exact',
      };
    }
    const hits = selected.filter((index) => correct.includes(index)).length;
    const partial = hits >= Math.ceil(correct.length / 2);
    if (partial) {
      return {
        isCorrect: false,
        quality: 3,
        correctText,
        matchedBy: 'partial',
        feedback: zh.study.answerWrong,
      };
    }
    return { isCorrect: false, quality: 0, correctText };
  },
  preview(card) {
    return { title: card.question, subtitle: labels(card, card.answer.indices) };
  },
};

export type { RawAnswer };
