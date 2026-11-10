import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { getCardDef, type GradeResult, type RawAnswer } from '@/cards';
import { submitAnswer } from '@/db/repository';
import type { Card } from '@/types';

type SessionState = {
  queue: Card[];
  index: number;
  startedAt: number;
  phase: 'answering' | 'revealed';
  draft: unknown;
  draftText: string;
  result: GradeResult | null;
  doneCount: number;
  correctCount: number;
  unsavedCount: number;
  start: (queue: Card[]) => void;
  selectOption: (index: number) => void;
  setDraft: (draft: unknown) => void;
  setDraftText: (text: string) => void;
  submit: (raw: RawAnswer) => Promise<void>;
  next: () => void;
  end: () => void;
};

const initialSession = {
  queue: [] as Card[],
  index: 0,
  startedAt: Date.now(),
  phase: 'answering' as const,
  draft: null,
  draftText: '',
  result: null,
  doneCount: 0,
  correctCount: 0,
  unsavedCount: 0,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialSession,
  start: (queue) => {
    set({
      ...initialSession,
      queue,
      startedAt: Date.now(),
    });
  },
  selectOption: (index) => set({ draft: [index] }),
  setDraft: (draft) =>
    set({
      draft,
      draftText: typeof draft === 'string' ? draft : get().draftText,
    }),
  setDraftText: (draftText) => set({ draftText, draft: draftText }),
  submit: async (raw) => {
    const state = get();
    const card = state.queue[state.index];
    if (!card || state.phase === 'revealed') {
      return;
    }
    const definition = getCardDef(card.type);
    if (!definition) {
      return;
    }
    const elapsedMs = Math.max(0, Date.now() - state.startedAt);
    const result = definition.grade({ card, raw, elapsedMs });
    set({
      phase: 'revealed',
      result,
      doneCount: state.doneCount + 1,
      correctCount: state.correctCount + (result.isCorrect ? 1 : 0),
    });
    await Haptics.impactAsync(
      result.isCorrect
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => undefined);

    try {
      await submitAnswer({
        cardId: card.id,
        deckId: card.deckId,
        quality: result.quality,
        isCorrect: result.isCorrect,
        elapsedMs,
        answerRaw: JSON.stringify(raw),
        grade: result,
      });
    } catch (error: unknown) {
      console.warn('答题记录写入失败', error);
      set({ unsavedCount: get().unsavedCount + 1 });
    }
  },
  next: () => {
    const state = get();
    const nextIndex = state.index + 1;
    if (nextIndex >= state.queue.length) {
      set({ index: state.queue.length });
      return;
    }
    set({
      index: nextIndex,
      startedAt: Date.now(),
      phase: 'answering',
      draft: null,
      draftText: '',
      result: null,
    });
  },
  end: () => set({ index: get().queue.length }),
}));
