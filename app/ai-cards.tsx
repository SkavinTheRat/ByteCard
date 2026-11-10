import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearAICards,
  deleteAICards,
  getAICardStats,
  getAIGenerationUsage,
  listAICards,
  listDecks,
  type AICardSummary,
} from '@/db/repository';
import { findWeakestTopic } from '@/ai/topics';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { colors, radius, space, stroke, type } from '@/theme';
import type { Deck } from '@/types';
import { AICardExportActions } from '@/components/AICardExportActions';

type Stats = { count: number; total: number; percent: number };
type ConfirmAction = { kind: 'delete'; card: AICardSummary } | { kind: 'clear' } | null;

function dateLabel(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function AICardsScreen() {
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<AICardSummary[]>([]);
  const [stats, setStats] = useState<Stats>({ count: 0, total: 0, percent: 0 });
  const [usage, setUsage] = useState({ used: 0, limit: 10 });
  const [showAll, setShowAll] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const load = useCallback(async () => {
    try {
      const [deckRows, cardRows, cardStats, generation] = await Promise.all([
        listDecks(),
        listAICards(200),
        getAICardStats(),
        getAIGenerationUsage(),
      ]);
      setDecks(deckRows);
      setCards(cardRows);
      setStats(cardStats);
      setUsage(generation);
      setFailed(false);
    } catch (error: unknown) {
      console.warn('AI 补卡页读取失败', error);
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function start(deckId: string) {
    if (usage.used >= usage.limit) {
      showToast(zh.aiCard.limit(usage.limit));
      return;
    }
    const topic = await findWeakestTopic(deckId);
    router.push({
      pathname: '/ai-card',
      params: {
        deckId,
        topicId: topic?.id ?? '',
        point: topic?.points[0] ?? '',
      },
    });
  }

  async function doConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === 'delete') {
        await deleteAICards([confirm.card.id]);
      } else {
        await clearAICards();
      }
      setConfirm(null);
      await load();
      showToast(zh.aiManage.removed);
    } catch (error: unknown) {
      console.warn('删除 AI 卡失败', error);
      showToast(zh.aiManage.loadError);
    }
  }

  const visibleCards = showAll ? cards : cards.slice(0, 5);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Ionicons color={colors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>{zh.aiManage.title}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.xxxl },
        ]}
      >
        {failed ? <Text style={styles.error}>{zh.aiManage.loadError}</Text> : null}
        <View style={styles.usagePanel}>
          <Text style={styles.usage}>{zh.aiManage.today(usage.used, usage.limit)}</Text>
          <Text style={styles.caption}>
            {usage.used >= usage.limit ? zh.aiManage.limitReached : zh.aiManage.chooseDeck}
          </Text>
        </View>
        <View style={styles.deckGrid}>
          {decks.map((deck) => {
            const disabled = usage.used >= usage.limit;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={deck.id}
                onPress={() => void start(deck.id)}
                style={({ pressed }) => [
                  styles.deckButton,
                  { borderColor: deck.accent },
                  disabled && styles.disabled,
                  pressed && !disabled && styles.pressed,
                ]}
              >
                <Ionicons color={deck.accent} name="add-circle-outline" size={22} />
                <View style={styles.deckCopy}>
                  <Text style={[styles.deckCode, { color: deck.accent }]}>{deck.code}</Text>
                  <Text style={styles.deckName}>{deck.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{zh.aiManage.collected(stats.count, stats.percent)}</Text>
        {cards.length === 0 ? <Text style={styles.caption}>{zh.aiManage.empty}</Text> : null}
        <View style={styles.list}>
          {visibleCards.map((card) => (
            <Pressable
              accessibilityRole="button"
              key={card.id}
              onLongPress={() => setConfirm({ kind: 'delete', card })}
              style={styles.cardRow}
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardDeck}>{card.deckId.toUpperCase()}</Text>
                <Text numberOfLines={2} style={styles.cardQuestion}>{card.question}</Text>
              </View>
              <Text style={styles.date}>{dateLabel(card.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
        {cards.length > 5 ? (
          <Pressable onPress={() => setShowAll((value) => !value)} style={styles.textButton}>
            <Text style={styles.action}>{showAll ? zh.aiManage.collapse : zh.aiManage.viewAll}</Text>
          </Pressable>
        ) : null}
        {cards.length > 0 ? <Text style={styles.hint}>{zh.aiManage.longPressHint}</Text> : null}
        <AICardExportActions count={cards.length} />
        {cards.length > 0 ? (
          <Pressable onPress={() => setConfirm({ kind: 'clear' })} style={styles.clearButton}>
            <Text style={styles.danger}>{zh.aiManage.clear}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <ConfirmSheet
        confirmLabel={confirm?.kind === 'clear' ? zh.aiManage.clearConfirm : zh.aiManage.deleteConfirm}
        message={
          confirm?.kind === 'clear'
            ? zh.aiManage.clearBody(stats.count)
            : zh.aiManage.deleteBody
        }
        onClose={() => setConfirm(null)}
        onConfirm={() => void doConfirm()}
        title={confirm?.kind === 'clear' ? zh.aiManage.clearTitle : zh.aiManage.deleteTitle}
        visible={confirm !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center' },
  title: { ...type.title, color: colors.text, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  content: { padding: space.lg, gap: space.lg },
  usagePanel: { padding: space.lg, gap: space.xs, backgroundColor: colors.surface, borderWidth: stroke.hair, borderColor: colors.border, borderRadius: radius.md },
  usage: { ...type.title, color: colors.primary },
  caption: { ...type.caption, color: colors.textDim },
  deckGrid: { gap: space.sm },
  deckButton: { minHeight: 58, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: stroke.hair, borderRadius: radius.md, backgroundColor: colors.surface },
  deckCopy: { flex: 1 },
  deckCode: { ...type.micro },
  deckName: { ...type.small, color: colors.text },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: colors.surfaceHigh },
  sectionTitle: { ...type.small, color: colors.text },
  list: { gap: space.sm },
  cardRow: { minHeight: 76, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: stroke.hair, borderColor: colors.border },
  cardBody: { flex: 1, gap: space.xs },
  cardDeck: { ...type.micro, color: colors.primary },
  cardQuestion: { ...type.small, color: colors.text },
  date: { ...type.micro, color: colors.textMute },
  textButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  action: { ...type.small, color: colors.primary },
  hint: { ...type.micro, color: colors.textMute },
  clearButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hair, borderColor: colors.danger, borderRadius: radius.md },
  danger: { ...type.small, color: colors.danger },
  error: { ...type.caption, color: colors.danger },
});
