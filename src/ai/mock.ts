import { listCardsByDeck, listDecks } from '@/db/repository';
import type { AIProvider, AIRequest, AIResponse } from './provider';

export class MockProvider implements AIProvider {
  readonly id = 'mock';

  async isConfigured(): Promise<boolean> {
    return true;
  }

  async explain(request: AIRequest): Promise<AIResponse> {
    if (request.kind === 'rephrase') {
      const first = request.card.explain.split(/[。！？\n]/)[0] ?? request.card.explain;
      return {
        source: 'mock',
        text: `换个说法：${first}。\n记住这个点：${request.card.tags.join('、')}。`,
      };
    }
    if (request.kind === 'example') {
      const decks = await listDecks();
      const deck = decks.find((item) => item.id === request.card.deckId);
      return {
        source: 'mock',
        text: `这个知识点在 ${deck?.name ?? request.card.deckId} 里常以「${
          request.card.tags[0] ?? '核心概念'
        }」的形式考，注意区分相邻概念。`,
      };
    }

    const cards = await listCardsByDeck(request.card.deckId);
    const candidates = cards.filter(
      (card) => card.id !== request.card.id && card.options && card.options.length >= 2,
    );
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    if (!picked || !picked.options) {
      return {
        source: 'mock',
        text: `练一道：${request.card.question}\nA. 先回忆定义\nB. 再检查边界\nC. 最后核对复杂度\nD. 以上都不对`,
      };
    }
    const options = picked.options
      .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
      .join('\n');
    return { source: 'mock', text: `练一道：${picked.question}\n${options}` };
  }
}
