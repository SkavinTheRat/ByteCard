/// <reference types="jest" />

import deckData from '../assets/data/decks.json';
import agentCards from '../assets/data/cards/agent.json';
import agentAdvancedCards from '../assets/data/cards/agent-advanced.json';
import agentBasicCards from '../assets/data/cards/agent-basic.json';
import aiCards from '../assets/data/cards/ai.json';
import cnCards from '../assets/data/cards/cn.json';
import coCards from '../assets/data/cards/co.json';
import dsCards from '../assets/data/cards/ds.json';
import llmAdvancedCards from '../assets/data/cards/llm-advanced.json';
import llmBasicCards from '../assets/data/cards/llm-basic.json';
import osCards from '../assets/data/cards/os.json';
import { loadBundledDeck } from '@/db/seed';
import { validateDecks } from '@/db/validateDecks';

type MutableBundle = {
  decks: unknown[];
  cards: Array<Record<string, unknown>>;
};

function bundledInput(): MutableBundle {
  return {
    ...deckData,
    decks: deckData.decks.map((deck) => ({ ...deck, enabled: true })),
    cards: [
      ...dsCards.cards,
      ...coCards.cards,
      ...osCards.cards,
      ...cnCards.cards,
      ...aiCards.cards,
      ...agentCards.cards,
      ...llmBasicCards.cards,
      ...llmAdvancedCards.cards,
      ...agentBasicCards.cards,
      ...agentAdvancedCards.cards,
    ].map((card) => JSON.parse(JSON.stringify(card)) as Record<string, unknown>),
  } as unknown as MutableBundle;
}

describe('validateDecks', () => {
  it('内置题库通过全部结构校验', () => {
    expect(validateDecks(loadBundledDeck())).toEqual([]);
  });

  it('缺字段会被报告', () => {
    const input = bundledInput();
    const broken = { ...input.cards[0] };
    delete broken.explain;
    input.cards[0] = broken;
    expect(validateDecks(input).some((error) => error.includes('解析少于 40 字'))).toBe(
      true,
    );
  });

  it('重复 id 会被报告', () => {
    const input = bundledInput();
    input.cards[1] = { ...input.cards[0] };
    expect(validateDecks(input)).toContain('卡片 id 存在重复');
  });

  it('单选索引越界会被报告', () => {
    const input = bundledInput();
    const single = input.cards.find((card) => card.type === 'single');
    const options = single?.options;
    const answer = single?.answer;
    if (
      !single ||
      !Array.isArray(options) ||
      typeof answer !== 'object' ||
      answer === null
    ) {
      throw new Error('测试题库缺少单选卡');
    }
    (answer as { index: number }).index = options.length;
    expect(validateDecks(input).some((error) => error.includes('越界'))).toBe(true);
  });

  it('内置单选正确项在 A/B/C/D 上保持均衡', () => {
    const singles = loadBundledDeck().cards.filter(
      (card) => card.type === 'single' && card.options.length === 4,
    );
    const counts = [0, 1, 2, 3].map(
      (position) =>
        singles.filter(
          (card) => card.type === 'single' && card.answer.index === position,
        ).length,
    );

    expect(singles.length).toBeGreaterThanOrEqual(100);
    expect(Math.max(...counts) / singles.length).toBeLessThanOrEqual(0.35);
  });

  it('绝大多数正确项集中在 A 时会被题库审计报告', () => {
    const input = bundledInput();
    for (const card of input.cards) {
      if (card.type === 'single' && typeof card.answer === 'object' && card.answer) {
        (card.answer as { index: number }).index = 0;
      }
    }

    expect(
      validateDecks(input).some((error) => error.includes('正确项位置过于集中')),
    ).toBe(true);
  });
});
