import type { Card } from '@/types';

export function interleaveByDeck(cards: Card[]): Card[] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.deckId);
    if (group) {
      group.push(card);
    } else {
      groups.set(card.deckId, [card]);
    }
  }

  const orderedGroups = [...groups.values()];
  const result: Card[] = [];
  let cursor = 0;
  let remaining = cards.length;
  while (remaining > 0) {
    for (const group of orderedGroups) {
      const card = group[cursor];
      if (card) {
        result.push(card);
        remaining -= 1;
      }
    }
    cursor += 1;
  }
  return result;
}

export function buildQueue(input: {
  dueCards: Card[];
  newCards: Card[];
  newLimit: number;
  reviewLimit: number;
}): Card[] {
  const seen = new Set<string>();
  const due = interleaveByDeck(
    input.dueCards.slice(0, Math.max(0, input.reviewLimit)),
  );
  const fresh = interleaveByDeck(
    input.newCards.slice(0, Math.max(0, input.newLimit)),
  );
  return [...due, ...fresh].filter((card) => {
    if (seen.has(card.id)) {
      return false;
    }
    seen.add(card.id);
    return true;
  });
}
