import type { AIRequest } from './provider';
import { getCardDef } from '@/cards';

export {
  CARD_SYSTEM_PROMPT,
  buildCardGenerationPrompt,
} from './cardPrompt';

export const SYSTEM_PROMPT = `你是一个计算机考研（408）与 AI 基础的助教。学生在做概念卡片练习时答错了题。
你的任务是针对性地补充讲解，不是重新讲一遍整个知识点。

硬性要求：
1. 用中文，160 字以内，不要客套话，不要"很好的问题"这类开场。
2. 纯文本，不要 Markdown 标题、不要代码块围栏、不要超过 3 个短句组成的列表。
3. 结构固定为三段：第一句点出他错在哪 / 第二句给出正确理解 / 第三句给一个能记住的类比或口诀。
4. 只讲这一张卡涉及的知识点，不要扩展到他没问的内容。
5. 如果卡片内容涉及你不确定的具体数值或公式，明确说"这条我记不准，以教材为准"。`;

export function correctAnswerText(request: AIRequest): string {
  const { card } = request;
  return getCardDef(card.type)?.answerText(card) ?? '';
}

export function buildUserPrompt(request: AIRequest): string {
  const base = `卡片：${request.card.question}
正确答案：${correctAnswerText(request)}
学生选择：${request.userAnswer}`;
  if (request.kind === 'example') {
    return `${base}
给一个具体的小例子（数字或代码都行），不要超过 3 行。`;
  }
  if (request.kind === 'quiz') {
    return `${base}
再出 1 道同知识点的单选题，只给题干和 4 个选项，不要给答案。`;
  }
  return `${base}
换个角度再讲一遍。`;
}
