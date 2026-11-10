import type { Card, Deck } from '@/types';

export type DeckRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  accent: string;
  sort_order: number;
  enabled: number;
};

export type CardRow = {
  id: string;
  deck_id: string;
  type: string;
  question: string;
  code: string | null;
  options: string | null;
  answer: string;
  payload: string;
  explain: string;
  tags: string;
  difficulty: number;
  source: 'seed' | 'ai';
  verified_at: string | null;
  sort_order: number;
};

function parseStringArray(value: string | null, fallback: string[] = []): string[] {
  if (!value) {
    return fallback;
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    return fallback;
  }
  return parsed;
}

function parseAnswer(value: string): unknown {
  return JSON.parse(value);
}

function difficulty(value: number): 1 | 2 | 3 {
  return value === 1 || value === 3 ? value : 2;
}

export function mapDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    accent: row.accent,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
  };
}

export function mapCard(row: CardRow): Card {
  const base = {
    id: row.id,
    deckId: row.deck_id,
    question: row.question,
    code: row.code ?? undefined,
    explain: row.explain,
    tags: parseStringArray(row.tags),
    difficulty: difficulty(row.difficulty),
    payload: parsePayload(row.payload),
    source: row.source,
    verifiedAt: row.verified_at ?? undefined,
    sortOrder: row.sort_order,
  };
  const options = parseStringArray(row.options);
  const answer = parseAnswer(row.answer);

  if (row.type === 'single' && typeof answer === 'object' && answer !== null) {
    const index = (answer as { index?: unknown }).index;
    if (typeof index === 'number') {
      return { ...base, type: 'single', options, answer: { index } };
    }
  }
  if (row.type === 'multi' && typeof answer === 'object' && answer !== null) {
    const indices = (answer as { indices?: unknown }).indices;
    if (Array.isArray(indices) && indices.every((item) => typeof item === 'number')) {
      return { ...base, type: 'multi', options, answer: { indices } };
    }
  }
  if (row.type === 'fill' && typeof answer === 'object' && answer !== null) {
    const accept = (answer as { accept?: unknown }).accept;
    const hint = (answer as { hint?: unknown }).hint;
    if (Array.isArray(accept) && accept.every((item) => typeof item === 'string')) {
      return {
        ...base,
        type: 'fill',
        options: null,
        answer: {
          accept,
          hint: typeof hint === 'string' ? hint : undefined,
        },
      };
    }
  }
  if (row.type === 'judge' && typeof answer === 'object' && answer !== null) {
    const value = (answer as { value?: unknown }).value;
    if (typeof value === 'boolean') {
      return { ...base, type: 'judge', options: null, answer: { value } };
    }
  }

  throw new Error(`卡片 ${row.id} 的 JSON 字段无效`);
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || '{}');
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}
