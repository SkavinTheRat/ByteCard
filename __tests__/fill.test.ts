/// <reference types="jest" />

import { matchFillAnswer, normalizeAnswer } from '@/utils/fill';
import { levenshtein } from '@/utils/levenshtein';

describe('normalizeAnswer', () => {
  it('归一化全角字符、空白和大小写', () => {
    expect(normalizeAnswer(' Ｏ（ Log  N ） ')).toBe('o(logn)');
  });

  it('把常见数学符号转成半角等价写法', () => {
    expect(normalizeAnswer('n≤m → 2×n')).toBe('n<=m->2*n');
  });
});

describe('matchFillAnswer', () => {
  it('忽略 O(logn) 与 O(log n) 的空格差异', () => {
    expect(
      matchFillAnswer('O(log n)', ['O(logn)', 'O(log n)']).matchedBy,
    ).toBe('exact');
  });

  it('允许归一化后编辑距离为 1 的近似答案', () => {
    const result = matchFillAnswer('O(logm)', ['O(logn)']);
    expect(result.matchedBy).toBe('near');
    expect(result.standard).toBe('O(logn)');
  });

  it('差异过大时判错', () => {
    expect(matchFillAnswer('O(n^2)', ['O(logn)']).matchedBy).toBeNull();
  });
});

describe('levenshtein', () => {
  it('计算插入、删除和替换距离', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
});
