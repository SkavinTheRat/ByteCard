import Constants from 'expo-constants';
import { getAIExportCards } from '@/db/aiRepository';

export type AIExportPayload = {
  kind: 'bytecard-export';
  exportedAt: string;
  appVersion: string;
  cards: Array<Record<string, unknown>>;
};

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function buildAIExport(): Promise<{
  count: number;
  text: string;
}> {
  const rows = await getAIExportCards();
  const cards = rows.map((row) => ({
    id: row.id,
    deckId: row.deckId,
    type: row.type,
    question: row.question,
    code: row.code,
    options: parseJson(row.options, null),
    answer: parseJson(row.answer, {}),
    explain: row.explain,
    tags: parseJson(row.tags, []),
    difficulty: row.difficulty,
    payload: parseJson(row.payload, {}),
  }));
  const payload: AIExportPayload = {
    kind: 'bytecard-export',
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    cards,
  };
  return { count: cards.length, text: JSON.stringify(payload, null, 2) };
}
