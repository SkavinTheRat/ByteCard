import { useMemo } from 'react';
import type { Card } from '@/types';
import {
  applySingleOptionOrder,
  displayIndexToOriginal,
  shuffleSingleOptions,
  type SingleOptionOrder,
} from '@/utils/singleOptions';

export function useSingleOptionOrder(card: Card | null | undefined): {
  order: SingleOptionOrder | null;
  displayCard: Card | null;
  originalIndexForDisplay: (displayIndex: number) => number | undefined;
} {
  const order = useMemo(
    () =>
      card?.type === 'single'
        ? shuffleSingleOptions(card.options, card.answer.index)
        : null,
    [card],
  );
  const displayCard = useMemo(
    () =>
      card?.type === 'single' && order
        ? applySingleOptionOrder(card, order)
        : (card ?? null),
    [card, order],
  );

  return {
    order,
    displayCard,
    originalIndexForDisplay: (displayIndex) =>
      order ? displayIndexToOriginal(order, displayIndex) : undefined,
  };
}
