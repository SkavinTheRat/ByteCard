/// <reference types="jest" />

import { buildQueue, interleaveByDeck } from '@/srs/queue';
import type { Card, SingleCard } from '@/types';

function card(id: string, deckId: string): SingleCard {
  return {
    id,
    deckId,
    type: 'single',
    question: id,
    explain: '测试解析',
    tags: ['测试'],
    difficulty: 1,
    options: ['A', 'B'],
    answer: { index: 0 },
  };
}

describe('queue', () => {
  it('按学科首现顺序稳定轮流取卡', () => {
    const input = [
      card('ds-1', 'ds'),
      card('ds-2', 'ds'),
      card('ds-3', 'ds'),
      card('os-1', 'os'),
      card('os-2', 'os'),
    ];
    expect(interleaveByDeck(input).map((item) => item.id)).toEqual([
      'ds-1',
      'os-1',
      'ds-2',
      'os-2',
      'ds-3',
    ]);
  });

  it('复习卡在前，新卡交错后追加，且按 id 去重', () => {
    const due = [card('ds-1', 'ds'), card('ds-2', 'ds'), card('cn-1', 'cn')];
    const fresh = [card('os-1', 'os'), card('ai-1', 'ai'), card('ds-1', 'ds')];
    const result = buildQueue({
      dueCards: due,
      newCards: fresh,
      newLimit: 2,
      reviewLimit: 2,
    });
    expect(result.map((item) => item.id)).toEqual([
      'ds-1',
      'ds-2',
      'os-1',
      'ai-1',
    ]);
  });
});
