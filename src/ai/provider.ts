import type { Card } from '@/types';
import { getSetting } from '@/db/repository';

export type AIRequest = {
  card: Card;
  userAnswer: string;
  kind: 'rephrase' | 'example' | 'quiz';
};

export type AIResponse = {
  text: string;
  source: 'mock' | 'deepseek';
};

export interface AIProvider {
  readonly id: string;
  isConfigured(): Promise<boolean>;
  explain(req: AIRequest, signal?: AbortSignal): Promise<AIResponse>;
}

export async function getProvider(): Promise<AIProvider> {
  const key = await getSetting('ai_api_key');
  if (!key) {
    const { MockProvider } = await import('./mock');
    return new MockProvider();
  }
  const { DeepSeekProvider } = await import('./deepseek');
  return new DeepSeekProvider(key);
}
