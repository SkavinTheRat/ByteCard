export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const insertion = (current[column - 1] ?? 0) + 1;
      const deletion = (previous[column] ?? 0) + 1;
      const substitution =
        (previous[column - 1] ?? 0) +
        (a[row - 1] === b[column - 1] ? 0 : 1);
      current[column] = Math.min(insertion, deletion, substitution);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
