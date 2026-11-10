import { colors } from './tokens';

export function deckAccent(deck: { accent?: string; id: string }): string {
  if (deck.accent) {
    return deck.accent;
  }
  return colors.deck[deck.id as keyof typeof colors.deck] ?? colors.primary;
}
