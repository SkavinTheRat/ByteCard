import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCardDef } from '@/cards';
import { generateCard, type GenerateResult, type GenerateUsage } from '@/ai/generateCard';
import { getExistingQuestions, listDecks, recordAIGeneration } from '@/db/repository';
import { insertVerifiedAICard, getAIGenerationUsage } from '@/db/repository';
import type { DraftCard } from '@/utils/cardValidate';
import { draftToCard } from '@/utils/cardValidate';
import { questionSimilarity } from '@/utils/similarity';
import { zh } from '@/i18n/zh';
import { colors, space } from '@/theme';
import { KnowledgeCard } from '@/components/KnowledgeCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { AICardFailure, AICardLoading } from '@/components/AICardFallbacks';
import { showToast } from '@/store/toastStore';
import type { Deck } from '@/types';
import { aiCardStyles as styles } from '@/components/AICardStyles';

type Params = {
  deckId?: string | string[];
  topicId?: string | string[];
  point?: string | string[];
};

type ReadyState = {
  card: DraftCard;
  usage: GenerateUsage;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function AICardScreen() {
  const params = useLocalSearchParams<Params>();
  const deckId = first(params.deckId) ?? 'ds';
  const topicId = first(params.topicId);
  const point = first(params.point);
  const insets = useSafeAreaInsets();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [error, setError] = useState<GenerateResult & { ok: false } | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<'answering' | 'revealed'>('answering');
  const [draft, setDraft] = useState<unknown>(null);
  const [grade, setGrade] = useState<ReturnType<NonNullable<ReturnType<typeof getCardDef>>['grade']> | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startedAt = useRef(Date.now());
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setSlow(false);
    setReady(null);
    setError(null);
    const slowTimer = setTimeout(() => setSlow(true), 8_000);
    try {
      const [decks, questions, usage] = await Promise.all([
        listDecks(),
        getExistingQuestions(deckId),
        getAIGenerationUsage(),
      ]);
      setDeck(decks.find((item) => item.id === deckId) ?? null);
      if (usage.used >= usage.limit) {
        setError({ ok: false, reason: 'network', message: zh.aiCard.limit(usage.limit) });
        return;
      }
      const result = await generateCard({
        deckId,
        topicId,
        point,
        existingStems: questions.slice(0, 20).map((item) => item.slice(0, 40)),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setError(result);
        return;
      }
      await recordAIGeneration();
      const similar = questions.find(
        (question) => questionSimilarity(question, result.card.question) > 0.75,
      );
      if (similar) {
        setError({
          ok: false,
          reason: 'invalid',
          message: zh.aiCard.duplicate(similar.slice(0, 20)),
        });
        return;
      }
      setReady({ card: result.card, usage: result.usage });
      setPhase('answering');
      setDraft(null);
      setGrade(null);
      startedAt.current = Date.now();
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) {
        setError({
          ok: false,
          reason: 'network',
          message: requestError instanceof Error ? requestError.message : zh.aiCard.loadFailed,
        });
      }
    } finally {
      clearTimeout(slowTimer);
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [deckId, point, topicId]);

  useEffect(() => {
    void run();
    return () => abortRef.current?.abort();
  }, [run]);

  const viewCard = ready ? draftToCard(ready.card, 'ai-draft') : null;
  const definition = viewCard ? getCardDef(viewCard.type) : undefined;

  function submit(raw: Parameters<NonNullable<typeof definition>['grade']>[0]['raw']) {
    if (!viewCard || !definition || phase === 'revealed') return;
    const result = definition.grade({
      card: viewCard,
      raw,
      elapsedMs: Math.max(0, Date.now() - startedAt.current),
    });
    setGrade(result);
    setPhase('revealed');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }

  async function save() {
    if (!ready || !grade) return;
    setSaving(true);
    try {
      const total = await insertVerifiedAICard(ready.card);
      showToast(zh.aiCard.saved(total));
      router.back();
    } catch (saveError: unknown) {
      showToast(saveError instanceof Error ? saveError.message : zh.me.loadError);
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/stats');
  }

  if (loading) {
    return <AICardLoading slow={slow} onClose={leave} />;
  }

  if (error || !ready || !viewCard || !definition) {
    const isUncertain = error?.reason === 'skipped' || error?.reason === 'low_confidence';
    return (
      <AICardFailure
        message={error?.message ?? zh.aiCard.loadFailed}
        uncertain={isUncertain}
        onBack={leave}
        onRetry={() => void run()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{zh.aiCard.title}</Text>
          <Pressable accessibilityRole="button" onPress={() => setCloseOpen(true)} hitSlop={8}>
            <Ionicons color={colors.textDim} name="close" size={24} />
          </Pressable>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.meta}>
            <Text style={styles.metaText}>{deck?.name ?? deckId}</Text>
            <Text style={styles.metaText}>{point ?? ready.card.sourcePoint}</Text>
          </View>
          <KnowledgeCard
            accent={deck?.accent ?? colors.primary}
            badge={zh.aiCard.badge}
            card={viewCard}
            deckCode={deck?.code ?? deckId.toUpperCase()}
            position={1}
            total={1}
          />
          <definition.AnswerView
            card={viewCard}
            draft={draft}
            phase={phase}
            result={grade}
            onDraftChange={setDraft}
            onSubmit={submit}
            onInputFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
          />
          {phase === 'revealed' && grade ? (
            <View style={styles.explainPanel}>
              <Text style={[styles.result, { color: grade.isCorrect ? colors.success : colors.danger }]}>
                {grade.isCorrect ? zh.study.correct : zh.study.incorrect}
              </Text>
              <Text style={styles.explain}>{ready.card.explain}</Text>
              <Text style={styles.hint}>{zh.aiCard.tokenUsage(ready.usage.total, ready.usage.estimated)}</Text>
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>{zh.aiCard.confirmTitle}</Text>
                <Text style={styles.confirmBody}>{zh.aiCard.confirmBody}</Text>
                <PrimaryButton disabled={saving} label={zh.aiCard.save} onPress={() => void save()} />
                <Pressable accessibilityRole="button" onPress={leave} style={styles.secondary}>
                  <Text style={styles.secondaryText}>{zh.aiCard.discard}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.bottomSpace, { paddingBottom: Math.max(insets.bottom, space.md) }]} />
      </KeyboardAvoidingView>
      <ConfirmSheet
        confirmLabel={zh.aiCard.leave}
        message={zh.aiCard.closeBody}
        onClose={() => setCloseOpen(false)}
        onConfirm={leave}
        title={zh.aiCard.closeTitle}
        visible={closeOpen}
      />
    </SafeAreaView>
  );
}
