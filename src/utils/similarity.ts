export function normalizeQuestion(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()[\]{}<>《》]/g, '');
}

function trigrams(value: string): Set<string> {
  const text = normalizeQuestion(value);
  if (text.length < 3) {
    return new Set(text ? [text] : []);
  }
  const result = new Set<string>();
  for (let index = 0; index <= text.length - 3; index += 1) {
    result.add(text.slice(index, index + 3));
  }
  return result;
}

export function questionSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}
