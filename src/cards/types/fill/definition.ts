import type { FillCard } from '@/types';
import { zh } from '@/i18n/zh';
import { matchFillAnswer } from '@/utils/fill';
import type { CardDefinition, GradeResult, RawAnswer } from '../../registry';
import { FillAnswerView } from './AnswerView';

function validate(card: unknown): string[] {
  if (typeof card !== 'object' || card === null) {
    return ['填空卡不是对象'];
  }
  const candidate = card as { options?: unknown; answer?: unknown };
  if (candidate.options !== null) {
    return ['填空 options 必须为 null'];
  }
  const answer = candidate.answer;
  const accept =
    typeof answer === 'object' && answer !== null
      ? (answer as { accept?: unknown }).accept
      : undefined;
  if (
    !Array.isArray(accept) ||
    accept.length === 0 ||
    !accept.every((item) => typeof item === 'string')
  ) {
    return ['填空 accept 必须是非空字符串数组'];
  }
  return [];
}

export const fillDefinition: CardDefinition<FillCard> = {
  type: 'fill',
  label: '填空',
  schemaVersion: 1,
  validate,
  AnswerView: FillAnswerView,
  answerText: (card) => card.answer.accept[0] ?? '',
  grade({ card, raw, elapsedMs }): GradeResult {
    const input = raw.kind === 'text' ? raw.value : '';
    const match = matchFillAnswer(input, card.answer.accept);
    if (match.matchedBy === 'exact') {
      return {
        isCorrect: true,
        quality: elapsedMs <= 15_000 ? 5 : 4,
        correctText: match.standard,
        matchedBy: 'exact',
      };
    }
    if (match.matchedBy === 'near') {
      return {
        isCorrect: false,
        quality: 3,
        correctText: match.standard,
        matchedBy: 'near',
        feedback: `${zh.study.answerNear}${match.standard}`,
      };
    }
    return { isCorrect: false, quality: 0, correctText: match.standard };
  },
  preview(card) {
    return { title: card.question, subtitle: card.answer.accept[0] ?? '' };
  },
};

export type { RawAnswer };
