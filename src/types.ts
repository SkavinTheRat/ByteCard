export type Deck = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  accent: string;
  sortOrder: number;
  enabled: boolean;
};

export type CardType = 'single' | 'multi' | 'fill';

type CardBase = {
  id: string;
  deckId: string;
  question: string;
  code?: string;
  explain: string;
  tags: string[];
  difficulty: 1 | 2 | 3;
};

export type SingleCard = CardBase & {
  type: 'single';
  options: string[];
  answer: { index: number };
};

export type MultiCard = CardBase & {
  type: 'multi';
  options: string[];
  answer: { indices: number[] };
};

export type FillCard = CardBase & {
  type: 'fill';
  options: null;
  answer: { accept: string[]; hint?: string };
};

export type Card = SingleCard | MultiCard | FillCard;

export type ReviewState = {
  cardId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastQuality: number | null;
  lastReviewedAt: string | null;
  status: 'new' | 'learning' | 'review' | 'lapsed';
};

export type ReviewLog = {
  id: number;
  cardId: string;
  deckId: string;
  quality: number;
  isCorrect: boolean;
  elapsedMs: number;
  answerRaw: string | null;
  day: string;
  answeredAt: string;
};

export type DailyStat = {
  day: string;
  done: number;
  correct: number;
};

export type DeckBundle = {
  version: number;
  removed: string[];
  minAppVersion?: string;
  decks: Deck[];
  cards: Card[];
};
