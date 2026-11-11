import agentCards from '../../assets/data/cards/agent.json';
import agentAdvancedCards from '../../assets/data/cards/agent-advanced.json';
import agentBasicCards from '../../assets/data/cards/agent-basic.json';
import aiCards from '../../assets/data/cards/ai.json';
import cnCards from '../../assets/data/cards/cn.json';
import coCards from '../../assets/data/cards/co.json';
import dsCards from '../../assets/data/cards/ds.json';
import llmAdvancedCards from '../../assets/data/cards/llm-advanced.json';
import llmBasicCards from '../../assets/data/cards/llm-basic.json';
import osCards from '../../assets/data/cards/os.json';
import decksData from '../../assets/data/decks.json';
import type { Card, Deck, DeckBundle } from '@/types';
import { validateDecks } from './validateDecks';

type DeckSeed = Omit<Deck, 'enabled'>;
type CardGroup = { cards: unknown[] };

type DeckMetadata = {
  version: number;
  removed: string[];
  minAppVersion: string;
  decks: DeckSeed[];
};

export function loadBundledDeck(): DeckBundle {
  const metadata = decksData as DeckMetadata;
  const groups: Record<string, CardGroup> = {
    ds: dsCards,
    co: coCards,
    os: osCards,
    cn: cnCards,
    ai: aiCards,
    agent: agentCards,
    'llm-basic': llmBasicCards,
    'llm-advanced': llmAdvancedCards,
    'agent-basic': agentBasicCards,
    'agent-advanced': agentAdvancedCards,
  };
  const cards = metadata.decks.flatMap(
    (deck) => (groups[deck.id]?.cards ?? []) as Card[],
  );
  const bundle: DeckBundle = {
    version: metadata.version,
    removed: metadata.removed,
    minAppVersion: metadata.minAppVersion,
    decks: metadata.decks.map((deck) => ({ ...deck, enabled: true })),
    cards,
  };
  const errors = validateDecks(bundle);
  if (errors.length > 0) {
    throw new Error(`内置题库校验失败：${errors.join('；')}`);
  }
  return bundle;
}

export async function seedIfNeeded(): Promise<boolean> {
  const startedAt = Date.now();
  const { applyDeckBundle } = await import('./applyBundle');
  const applied = await applyDeckBundle(loadBundledDeck(), { source: 'bundled' });
  if (applied) {
    console.info(`[ByteCard] 题库 seed 完成：${Date.now() - startedAt}ms`);
  }
  return applied !== null;
}

export { validateDecks } from './validateDecks';
