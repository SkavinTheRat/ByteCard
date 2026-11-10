import { getSetting } from '@/db/repository';
import { zh } from '@/i18n/zh';
import type { AIProvider, AIRequest, AIResponse } from './provider';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompts';

type ChatConfig = {
  key: string;
  baseUrl: string;
  model: string;
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function sanitize(text: string): string {
  return text
    .replace(/```(?:text|markdown)?/gi, '')
    .replace(/```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function statusError(status: number): Error {
  if (status === 401) {
    return new Error(zh.ai.invalidKey);
  }
  if (status === 402 || status === 429) {
    return new Error(zh.ai.quota);
  }
  if (status >= 500) {
    return new Error(zh.ai.unavailable);
  }
  return new Error(zh.ai.requestFailed);
}

async function postChat(
  config: ChatConfig,
  messages: ChatMessage[],
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', forwardAbort, { once: true });
    }
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);

  try {
    const response = await fetch(
      `${normalizeBaseUrl(config.baseUrl)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.3,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw statusError(response.status);
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !Array.isArray((payload as { choices?: unknown }).choices)
    ) {
      throw new Error(zh.ai.invalidResponse);
    }
    const choices = (payload as { choices: unknown[] }).choices;
    const first = choices[0];
    if (typeof first !== 'object' || first === null) {
      throw new Error(zh.ai.invalidResponse);
    }
    const message = (first as { message?: unknown }).message;
    if (typeof message !== 'object' || message === null) {
      throw new Error(zh.ai.invalidResponse);
    }
    const content = (message as { content?: unknown }).content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error(zh.ai.invalidResponse);
    }
    return sanitize(content);
  } catch (error: unknown) {
    if (timedOut) {
      throw new Error(zh.ai.timeout);
    }
    if (error instanceof Error && error.message.startsWith('Key ')) {
      throw error;
    }
    const readableErrors: string[] = [
      zh.ai.invalidKey,
      zh.ai.quota,
      zh.ai.unavailable,
      zh.ai.requestFailed,
      zh.ai.invalidResponse,
    ];
    if (error instanceof Error && readableErrors.includes(error.message)) {
      throw error;
    }
    if (signal?.aborted) {
      throw new Error(zh.ai.cancelled);
    }
    throw new Error(zh.ai.network);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

async function getConfig(keyOverride?: string): Promise<ChatConfig> {
  const [key, baseUrl, model] = await Promise.all([
    keyOverride ? Promise.resolve(keyOverride) : getSetting('ai_api_key'),
    getSetting('ai_base_url'),
    getSetting('ai_model'),
  ]);
  return {
    key: key ?? '',
    baseUrl: baseUrl ?? 'https://api.deepseek.com',
    model: model ?? 'deepseek-chat',
  };
}

export class DeepSeekProvider implements AIProvider {
  readonly id = 'deepseek';

  constructor(private readonly key: string) {}

  async isConfigured(): Promise<boolean> {
    return this.key.trim().length > 0;
  }

  async explain(request: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const config = await getConfig(this.key);
    const text = await postChat(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(request) },
      ],
      400,
      signal,
    );
    return { text, source: 'deepseek' };
  }
}

export async function testDeepSeekConnection(input: {
  key: string;
  baseUrl: string;
  model: string;
}): Promise<void> {
  await postChat(
    {
      key: input.key,
      baseUrl: input.baseUrl,
      model: input.model,
    },
    [{ role: 'user', content: 'ping' }],
    8,
  );
}
