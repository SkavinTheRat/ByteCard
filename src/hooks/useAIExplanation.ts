import { useCallback, useEffect, useRef, useState } from 'react';
import { getAICache, saveAICache } from '@/db/repository';
import { getProvider, type AIRequest } from '@/ai/provider';
import { MAX_AI_REQUESTS, useSessionStore } from '@/store/sessionStore';
import type { Card } from '@/types';
import { zh } from '@/i18n/zh';

type Source = 'mock' | 'deepseek' | 'cached';
type Kind = AIRequest['kind'];
type MemoryCache = { text: string; source: Source; at: number };

const SIX_HOURS = 6 * 60 * 60 * 1000;
const memoryCache = new Map<string, MemoryCache>();

export function useAIExplanation(card: Card, userAnswer: string) {
  const [text, setText] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const lastKind = useRef<Kind>('rephrase');
  const consumeAIRequest = useSessionStore((state) => state.consumeAIRequest);
  const aiRequestCount = useSessionStore((state) => state.aiRequestCount);

  const stopTyping = useCallback(() => {
    if (typeTimer.current) {
      clearInterval(typeTimer.current);
      typeTimer.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setText('');
    setSource(null);
    setLoading(false);
    setError(null);
    void getAICache(card.id)
      .then((cache) => {
        if (mounted.current && cache.text) {
          setText(cache.text);
          setSource('cached');
        }
      })
      .catch((cacheError: unknown) => {
        console.warn('AI 缓存读取失败', cacheError);
      });
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      stopTyping();
    };
  }, [card.id, stopTyping]);

  const playText = useCallback(
    (value: string, nextSource: Source) =>
      new Promise<void>((resolve) => {
        stopTyping();
        setText('');
        setSource(nextSource);
        if (nextSource === 'cached') {
          setText(value);
          resolve();
          return;
        }
        let index = 0;
        typeTimer.current = setInterval(() => {
          if (!mounted.current) {
            stopTyping();
            resolve();
            return;
          }
          index += 1;
          setText(value.slice(0, index));
          if (index >= value.length) {
            stopTyping();
            resolve();
          }
        }, 18);
      }),
    [stopTyping],
  );

  const run = useCallback(
    async (kind: Kind) => {
      lastKind.current = kind;
      setError(null);
      const memoryKey = `${card.id}:${kind}`;
      const remembered = memoryCache.get(memoryKey);
      if (remembered && Date.now() - remembered.at < SIX_HOURS) {
        await playText(remembered.text, remembered.source);
        return;
      }
      if (kind === 'rephrase') {
        try {
          const cache = await getAICache(card.id);
          if (
            cache.text &&
            cache.generatedAt &&
            Date.now() - new Date(cache.generatedAt).getTime() < SIX_HOURS
          ) {
            memoryCache.set(memoryKey, {
              text: cache.text,
              source: 'cached',
              at: Date.now(),
            });
            await playText(cache.text, 'cached');
            return;
          }
        } catch (cacheError: unknown) {
          console.warn('AI 缓存检查失败', cacheError);
        }
      }
      if (!consumeAIRequest()) {
        setError(zh.ai.limit);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const provider = await getProvider();
        const response = await provider.explain(
          { card, userAnswer, kind },
          controller.signal,
        );
        if (!mounted.current || controller.signal.aborted) {
          return;
        }
        if (kind === 'rephrase' && response.source === 'deepseek') {
          try {
            await saveAICache(card.id, response.text);
          } catch (cacheError: unknown) {
            console.warn('AI 缓存写入失败', cacheError);
          }
        }
        memoryCache.set(memoryKey, {
          text: response.text,
          source: response.source,
          at: Date.now(),
        });
        await playText(response.text, response.source);
      } catch (requestError: unknown) {
        if (!controller.signal.aborted && mounted.current) {
          const message =
            requestError instanceof Error ? requestError.message : zh.ai.requestFailed;
          setError(message);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [card, consumeAIRequest, playText, userAnswer],
  );

  const retry = useCallback(() => {
    void run(lastKind.current);
  }, [run]);

  return {
    text,
    source,
    loading,
    error,
    limitReached: aiRequestCount >= MAX_AI_REQUESTS,
    run,
    retry,
  };
}
