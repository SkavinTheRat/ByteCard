import type { Card } from '@/types';

export function formatUserAnswer(card: Card, draft: unknown): string {
  if (typeof draft === 'string') {
    return draft;
  }
  if (!Array.isArray(draft)) {
    return '';
  }
  const options = card.options;
  if (!options) {
    return '';
  }
  return draft
    .filter((item): item is number => typeof item === 'number')
    .map((index) => options[index])
    .filter((item): item is string => Boolean(item))
    .join('；');
}
