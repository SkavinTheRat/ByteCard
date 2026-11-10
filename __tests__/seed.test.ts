/// <reference types="jest" />

import deckData from '../assets/data/decks.json';
import agentCards from '../assets/data/cards/agent.json';
import aiCards from '../assets/data/cards/ai.json';
import cnCards from '../assets/data/cards/cn.json';
import coCards from '../assets/data/cards/co.json';
import dsCards from '../assets/data/cards/ds.json';
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
    ],
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
});
