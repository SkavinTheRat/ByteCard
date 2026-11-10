import type { ComponentType } from 'react';
import type { Card } from '@/types';

export type RawAnswer =
  | { kind: 'index'; value: number }
  | { kind: 'indices'; value: number[] }
  | { kind: 'text'; value: string }
  | { kind: 'custom'; value: unknown };

export type GradeResult = {
  isCorrect: boolean;
  quality: number;
  correctText: string;
  matchedBy?: 'exact' | 'near' | 'partial';
  feedback?: string;
};

export type AnswerViewProps<C extends Card = Card> = {
  card: C;
  phase: 'answering' | 'revealed';
  draft: unknown;
  onDraftChange: (draft: unknown) => void;
  onSubmit: (raw: RawAnswer) => void;
  result: GradeResult | null;
};

export interface CardDefinition<C extends Card = Card> {
  type: string;
  label: string;
  schemaVersion: number;
  validate(card: unknown): string[];
  AnswerView: ComponentType<AnswerViewProps<C>>;
  answerText(card: C): string;
  grade(input: {
    card: C;
    raw: RawAnswer;
    elapsedMs: number;
  }): GradeResult;
  preview?(card: C): { title: string; subtitle?: string };
}

const registry = new Map<string, CardDefinition>();

export function registerCard<C extends Card>(
  definition: CardDefinition<C>,
): void {
  if (registry.has(definition.type)) {
    throw new Error(`Card type "${definition.type}" 已注册，检查 src/cards/index.ts`);
  }
  registry.set(definition.type, definition as unknown as CardDefinition);
}

export function getCardDef(type: string): CardDefinition | undefined {
  return registry.get(type);
}

export function isSupportedType(type: string): boolean {
  return registry.has(type);
}

export function listCardDefs(): CardDefinition[] {
  return [...registry.values()];
}

export function draftToIndices(draft: unknown): number[] {
  if (!Array.isArray(draft)) {
    return [];
  }
  return draft.filter((item): item is number => typeof item === 'number');
}

export function draftToText(draft: unknown): string {
  return typeof draft === 'string' ? draft : '';
}
