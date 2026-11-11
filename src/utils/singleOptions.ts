export type RandomSource = () => number;

export type SingleOptionOrder = {
  options: string[];
  correctIndex: number;
  originalIndices: number[];
};

type IndexedSingleCard = {
  options: string[];
  answer: { index: number };
};

type DeterministicSingleCard = IndexedSingleCard & {
  question: string;
};

function assertCorrectIndex(options: readonly string[], correctIndex: number): void {
  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    throw new RangeError('单选正确项索引越界');
  }
}

function boundedRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) {
    throw new RangeError('随机数必须是有限数值');
  }
  return Math.min(Math.max(value, 0), 1 - Number.EPSILON);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function shuffleSingleOptions(
  options: readonly string[],
  correctIndex: number,
  random: RandomSource = Math.random,
): SingleOptionOrder {
  assertCorrectIndex(options, correctIndex);
  const shuffledOptions = [...options];
  const originalIndices = options.map((_, index) => index);

  for (let current = shuffledOptions.length - 1; current > 0; current -= 1) {
    const target = Math.floor(boundedRandom(random) * (current + 1));
    [shuffledOptions[current], shuffledOptions[target]] = [
      shuffledOptions[target] as string,
      shuffledOptions[current] as string,
    ];
    [originalIndices[current], originalIndices[target]] = [
      originalIndices[target] as number,
      originalIndices[current] as number,
    ];
  }

  return {
    options: shuffledOptions,
    correctIndex: originalIndices.indexOf(correctIndex),
    originalIndices,
  };
}

export function displayIndexToOriginal(
  order: SingleOptionOrder,
  displayIndex: number,
): number | undefined {
  if (!Number.isInteger(displayIndex) || displayIndex < 0) {
    return undefined;
  }
  return order.originalIndices[displayIndex];
}

export function applySingleOptionOrder<T extends IndexedSingleCard>(
  card: T,
  order: SingleOptionOrder,
): T {
  return {
    ...card,
    options: [...order.options],
    answer: { index: order.correctIndex },
  };
}

export function normalizeSingleAnswerPosition<T extends DeterministicSingleCard>(
  card: T,
): T {
  assertCorrectIndex(card.options, card.answer.index);
  const canonicalOptions = [...card.options].sort();
  const target =
    stableHash(`${card.question}\u0000${canonicalOptions.join('\u0000')}`) %
    card.options.length;
  if (target === card.answer.index) {
    return {
      ...card,
      options: [...card.options],
      answer: { index: target },
    };
  }

  const options = [...card.options];
  [options[target], options[card.answer.index]] = [
    options[card.answer.index] as string,
    options[target] as string,
  ];
  return {
    ...card,
    options,
    answer: { index: target },
  };
}
