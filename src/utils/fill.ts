import { levenshtein } from './levenshtein';

const symbolMap: Record<string, string> = {
  '×': '*',
  '÷': '/',
  '≤': '<=',
  '≥': '>=',
  '→': '->',
};

export function normalizeAnswer(value: string): string {
  const halfWidth = value
    .replace(/\u3000/g, ' ')
    .replace(/[\uFF01-\uFF5E]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .replace(/，/g, ',')
    .replace(/；/g, ';')
    .toLowerCase();

  return halfWidth
    .replace(/[×÷≤≥→]/g, (symbol) => symbolMap[symbol] ?? symbol)
    .replace(/\s+/g, '');
}

export function matchFillAnswer(
  input: string,
  accepted: string[],
): { matchedBy: 'exact' | 'near' | null; standard: string } {
  const normalizedInput = normalizeAnswer(input);
  const standard = accepted[0] ?? '';
  const exact = accepted.some(
    (candidate) => normalizeAnswer(candidate) === normalizedInput,
  );
  if (exact) {
    return { matchedBy: 'exact', standard };
  }

  const near = accepted.some(
    (candidate) => levenshtein(normalizedInput, normalizeAnswer(candidate)) <= 1,
  );
  return { matchedBy: near ? 'near' : null, standard };
}
