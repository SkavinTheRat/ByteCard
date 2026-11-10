/// <reference types="jest" />

import { buildUserPrompt, correctAnswerText } from '@/ai/prompts';
import type { AIRequest } from '@/ai/provider';
import type { Card } from '@/types';

const fillCard: Card = {
  id: 'ai-fill',
  deckId: 'ai',
  type: 'fill',
  question: 'F1 使用什么平均值？',
  options: null,
  answer: { accept: ['调和平均'] },
  explain: 'F1 使用精确率与召回率的调和平均。',
  tags: ['F1'],
  difficulty: 1,
};

describe('AI prompts', () => {
  it('从填空卡提取标准答案', () => {
    const request: AIRequest = {
      card: fillCard,
      userAnswer: '算术平均',
      kind: 'rephrase',
    };
    expect(correctAnswerText(request)).toBe('调和平均');
  });

  it('rephrase 带上题干、正确答案和学生选择', () => {
    const prompt = buildUserPrompt({
      card: fillCard,
      userAnswer: '算术平均',
      kind: 'rephrase',
    });
    expect(prompt).toContain('卡片：F1 使用什么平均值？');
    expect(prompt).toContain('正确答案：调和平均');
    expect(prompt).toContain('学生选择：算术平均');
    expect(prompt).toContain('换个角度再讲一遍。');
  });

  it('example 明确限制为三行以内', () => {
    const prompt = buildUserPrompt({
      card: fillCard,
      userAnswer: '算术平均',
      kind: 'example',
    });
    expect(prompt).toContain('不要超过 3 行');
  });
});
