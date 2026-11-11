import { getSetting } from '@/db/repository';
import { validateDraftCard, type DraftCard } from '@/utils/cardValidate';
import { normalizeSingleAnswerPosition } from '@/utils/singleOptions';
import { CARD_SYSTEM_PROMPT, buildCardGenerationPrompt } from './prompts';
import { getTopic, listTopics } from './topics';

export type GenerateUsage = {
  input: number;
  output: number;
  total: number;
  estimated: boolean;
};

export type GenerateResult =
  | { ok: true; card: DraftCard; usage: GenerateUsage }
  | {
      ok: false;
      reason: 'skipped' | 'low_confidence' | 'invalid' | 'network';
      message: string;
    };

type ChatPayload = {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error('JSON 格式错误');
  }
}

function estimateUsage(input: string, output: string): GenerateUsage {
  const inputTokens = Math.ceil(input.length / 2);
  const outputTokens = Math.ceil(output.length / 2);
  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
    estimated: true,
  };
}

export async function generateCard(input: {
  deckId: string;
  topicId?: string;
  point?: string;
  existingStems: string[];
  signal?: AbortSignal;
}): Promise<GenerateResult> {
  const [key, baseUrl, model] = await Promise.all([
    getSetting('ai_api_key'),
    getSetting('ai_base_url'),
    getSetting('ai_model'),
  ]);
  if (!key?.trim()) {
    return {
      ok: false,
      reason: 'network',
      message: '先在“AI 讲解设置”里填写 API Key，才能生成新卡。',
    };
  }
  const topic =
    getTopic(input.topicId) ??
    listTopics(input.deckId).find((item) => item.points.includes(input.point ?? '')) ??
    listTopics(input.deckId).find((item) =>
      item.name.includes(input.point ?? '') ||
      item.points.some((candidate) =>
        candidate.includes(input.point ?? '') ||
        (input.point ?? '').includes(candidate),
      ),
    ) ??
    listTopics(input.deckId)[0];
  if (!topic) {
    return { ok: false, reason: 'invalid', message: '没有找到对应的知识点。' };
  }
  const point =
    topic.points.find((candidate) => candidate.includes(input.point ?? '')) ??
    topic.points[0] ??
    topic.name;
  const userPrompt = buildCardGenerationPrompt({
    deckName: input.deckId,
    topicName: topic.name,
    point,
    type: 'single',
    difficulty: 2,
    existingStems: input.existingStems,
    examples: [],
  });
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  input.signal?.addEventListener('abort', forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `${(baseUrl ?? 'https://api.deepseek.com').replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model ?? 'deepseek-chat',
          temperature: 0.9,
          max_tokens: 800,
          stream: false,
          messages: [
            { role: 'system', content: CARD_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return { ok: false, reason: 'network', message: `接口返回 HTTP ${response.status}。` };
    }
    const payload = (await response.json()) as ChatPayload;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, reason: 'invalid', message: '接口没有返回题目文本。' };
    }
    let parsed: unknown;
    try {
      parsed = parseJson(content);
    } catch {
      return { ok: false, reason: 'invalid', message: '模型返回的 JSON 无法解析。' };
    }
    if (typeof parsed === 'object' && parsed !== null && 'skip' in parsed) {
      const skip = (parsed as { skip?: unknown }).skip;
      if (skip === true) {
        return { ok: false, reason: 'skipped', message: '模型对这道题没有把握。' };
      }
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const confidence = Number(record.confidence);
      if (Number.isFinite(confidence) && confidence < 0.7) {
        return { ok: false, reason: 'low_confidence', message: '模型置信度偏低。' };
      }
      record.deckId = input.deckId;
      record.sourcePoint = record.sourcePoint ?? point;
      record.aiConfidence = Number.isFinite(confidence) ? confidence : 0.7;
    }
    const validated = validateDraftCard(parsed);
    if (!validated.card) {
      return {
        ok: false,
        reason: 'invalid',
        message: validated.errors.join('；'),
      };
    }
    const card =
      validated.card.type === 'single'
        ? normalizeSingleAnswerPosition(validated.card)
        : validated.card;
    const usage = payload.usage
      ? {
          input: Number(payload.usage.prompt_tokens ?? 0),
          output: Number(payload.usage.completion_tokens ?? 0),
          total: Number(payload.usage.total_tokens ?? 0),
          estimated: false,
        }
      : estimateUsage(userPrompt, content);
    return { ok: true, card, usage };
  } catch (error) {
    if (input.signal?.aborted) {
      return { ok: false, reason: 'network', message: '已取消生成。' };
    }
    return {
      ok: false,
      reason: 'network',
      message: error instanceof Error ? error.message : '网络请求失败。',
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', forwardAbort);
  }
}
