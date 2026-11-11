/// <reference types="jest" />

import { singleDefinition } from '@/cards/types/single/definition';
import type { SingleCard } from '@/types';
import { formatUserAnswer } from '@/utils/formatUserAnswer';
import {
  applySingleOptionOrder,
  displayIndexToOriginal,
  normalizeSingleAnswerPosition,
  shuffleSingleOptions,
  type RandomSource,
} from '@/utils/singleOptions';

const card: SingleCard = {
  id: 'ds-single-001',
  deckId: 'ds',
  type: 'single',
  question: '顺序表的随机访问时间复杂度是多少？',
  options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
  answer: { index: 0 },
  explain: '顺序表底层连续存储，按下标可以直接计算地址，因此随机访问是常数时间。',
  tags: ['顺序表'],
  difficulty: 1,
};

function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe('single option shuffling', () => {
  test('does not mutate input and preserves every option exactly once', () => {
    const before = JSON.parse(JSON.stringify(card)) as SingleCard;
    const order = shuffleSingleOptions(
      card.options,
      card.answer.index,
      seededRandom(7),
    );

    expect(card).toEqual(before);
    expect([...order.options].sort()).toEqual([...card.options].sort());
    expect(new Set(order.options).size).toBe(card.options.length);
    expect([...order.originalIndices].sort()).toEqual([0, 1, 2, 3]);
  });

  test('round-trips every display index to its original index', () => {
    const order = shuffleSingleOptions(
      card.options,
      card.answer.index,
      seededRandom(11),
    );

    order.originalIndices.forEach((originalIndex, displayIndex) => {
      expect(order.options[displayIndex]).toBe(card.options[originalIndex]);
      expect(displayIndexToOriginal(order, displayIndex)).toBe(originalIndex);
      expect(order.originalIndices.indexOf(originalIndex)).toBe(displayIndex);
    });
    expect(order.originalIndices[order.correctIndex]).toBe(card.answer.index);
  });

  test('grades correctly after mapping visible choices to original choices', () => {
    const order = shuffleSingleOptions(
      card.options,
      card.answer.index,
      seededRandom(19),
    );
    const correctOriginal = displayIndexToOriginal(order, order.correctIndex);
    const wrongDisplay = (order.correctIndex + 1) % card.options.length;
    const wrongOriginal = displayIndexToOriginal(order, wrongDisplay);
    if (correctOriginal === undefined || wrongOriginal === undefined) {
      throw new Error('显示索引映射失败');
    }

    expect(
      singleDefinition.grade({
        card,
        raw: { kind: 'index', value: correctOriginal },
        elapsedMs: 3_000,
      }),
    ).toMatchObject({ isCorrect: true, quality: 5 });
    expect(
      singleDefinition.grade({
        card,
        raw: { kind: 'index', value: wrongOriginal },
        elapsedMs: 3_000,
      }),
    ).toMatchObject({ isCorrect: false, quality: 0 });
  });

  test('records the option text the user actually saw', () => {
    const order = shuffleSingleOptions(
      card.options,
      card.answer.index,
      seededRandom(23),
    );
    const displayCard = applySingleOptionOrder(card, order);

    expect(formatUserAnswer(displayCard, [order.correctIndex])).toBe(
      card.options[card.answer.index],
    );
    expect(formatUserAnswer(displayCard, [order.correctIndex])).toBe(
      displayCard.options[order.correctIndex],
    );
  });

  test('uses an unbiased Fisher-Yates distribution across all four positions', () => {
    const random = seededRandom(2_026_111_1);
    const counts = [0, 0, 0, 0];
    const displays = 20_000;

    for (let index = 0; index < displays; index += 1) {
      const order = shuffleSingleOptions(card.options, card.answer.index, random);
      counts[order.correctIndex] = (counts[order.correctIndex] ?? 0) + 1;
    }

    expect(counts.every((count) => count > 0)).toBe(true);
    for (const count of counts) {
      expect(count / displays).toBeGreaterThan(0.22);
      expect(count / displays).toBeLessThan(0.28);
    }
  });

  test('normalizes generated answers deterministically without changing text', () => {
    const normalized = normalizeSingleAnswerPosition(card);
    const normalizedAgain = normalizeSingleAnswerPosition(normalized);

    expect(normalized.options[normalized.answer.index]).toBe(
      card.options[card.answer.index],
    );
    expect([...normalized.options].sort()).toEqual([...card.options].sort());
    expect(normalizedAgain).toEqual(normalized);
    expect(card.answer.index).toBe(0);
  });
});
