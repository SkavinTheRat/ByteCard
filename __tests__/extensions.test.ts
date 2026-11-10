import '@/cards';
import { judgeDefinition } from '@/cards/types/judge/definition';
import { validateRemoteBundle } from '@/db/validateBundle';
import { questionSimilarity } from '@/utils/similarity';
import type { JudgeCard } from '@/types';

const card: JudgeCard = {
  id: 'ds-999',
  deckId: 'ds',
  type: 'judge',
  question: '单链表中删除已知结点的后继可以在 O(1) 时间完成。',
  options: null,
  answer: { value: true },
  explain: '已知结点可直接修改 next 指针，再释放后继结点，因此是常数时间操作。',
  tags: ['链表'],
  difficulty: 2,
  payload: {},
  source: 'seed',
  sortOrder: 1,
};

describe('judge card type', () => {
  test('grades both directions', () => {
    expect(
      judgeDefinition.grade({
        card,
        raw: { kind: 'index', value: 0 },
        elapsedMs: 3_000,
      }),
    ).toMatchObject({ isCorrect: true, quality: 5 });
    expect(
      judgeDefinition.grade({
        card,
        raw: { kind: 'index', value: 1 },
        elapsedMs: 3_000,
      }),
    ).toMatchObject({ isCorrect: false, quality: 0 });
  });

  test('requires null options and boolean answer', () => {
    expect(judgeDefinition.validate(card)).toEqual([]);
    expect(
      judgeDefinition.validate({ ...card, options: [], answer: { value: 'yes' } }),
    ).toHaveLength(2);
  });
});

describe('bundle and similarity guards', () => {
  test('rejects an out-of-range answer in a whole bundle', () => {
    const errors = validateRemoteBundle({
      version: 2,
      decks: [{ id: 'ds', name: '数据结构' }],
      cards: [
        {
          id: 'ds-001',
          deckId: 'ds',
          type: 'single',
          question: '测试题干内容足够长吗',
          options: ['A', 'B', 'C', 'D'],
          answer: { index: 9 },
          explain: '测试解析内容足够长用于通过结构校验并且继续检查答案范围。',
          tags: ['测试'],
          difficulty: 1,
        },
      ],
    });
    expect(errors.some((error) => error.includes('越界'))).toBe(true);
  });

  test('detects near-duplicate questions', () => {
    expect(
      questionSimilarity(
        '顺序表删除元素平均需要移动多少个元素？',
        '顺序表删除一个元素平均需要移动多少个元素？',
      ),
    ).toBeGreaterThan(0.6);
  });
});
