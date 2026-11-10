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
import { BarChart } from '@/components/BarChart';
import { DeckAccuracyRow } from '@/components/DeckAccuracyRow';
import { Heatmap } from '@/components/Heatmap';
import { Screen } from '@/components/Screen';
import {
  getDailySeries,
  getDeckAccuracy,
  getStatsOverview,
  getWrongCards,
  type DeckAccuracy,
  type StatsOverview,
} from '@/db/repository';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';
import type { DailyStat } from '@/types';

type StatsData = {
  overview: StatsOverview;
  daily: DailyStat[];
  decks: DeckAccuracy[];
  wrongCount: number;
};

export default function StatsScreen() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [overview, daily, decks, wrong] = await Promise.all([
        getStatsOverview(),
        getDailySeries(35),
        getDeckAccuracy(),
        getWrongCards(999),
      ]);
      setData({ overview, daily, decks, wrongCount: wrong.length });
    } catch (error: unknown) {
      console.warn('统计数据读取失败', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const overview = data?.overview;
  const accuracyPercent =
    overview?.hasData ? `${Math.round(overview.accuracy * 100)}%` : '--';
  const streakColor =
    (overview?.streak ?? 0) >= 3 ? colors.warning : colors.text;
  const accuracyColor =
    overview?.hasData && overview.accuracy < 0.6
      ? colors.danger
      : colors.text;

  return (
    <Screen padded={false}>
      {loading && data ? <View style={styles.loadingLine} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{zh.stats.title}</Text>
        {failed && !data ? (
          <Pressable onPress={() => void load()} style={styles.errorBox}>
            <Text style={styles.error}>{zh.stats.loadError}</Text>
          </Pressable>
        ) : null}

        <View style={styles.overview}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: streakColor }]}>
              {overview?.hasData ? overview.streak : '--'}
            </Text>
            <Text style={styles.metricLabel}>{zh.stats.streak}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {overview?.hasData ? overview.total : '--'}
            </Text>
            <Text style={styles.metricLabel}>{zh.stats.total}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: accuracyColor }]}>
              {accuracyPercent}
            </Text>
            <Text style={styles.metricLabel}>{zh.stats.accuracy}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Heatmap data={data?.daily ?? []} />
        </View>
        <View style={styles.section}>
          <BarChart data={data?.daily ?? []} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{zh.stats.deckTitle}</Text>
          {data?.decks.length ? (
            <View style={styles.deckList}>
              {data.decks.map((deck) => (
                <DeckAccuracyRow item={deck} key={deck.deckId} />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>{zh.stats.deckEmpty}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/wrong')}
          style={styles.wrongRow}
        >
          <Text style={styles.wrongTitle}>{zh.stats.wrongBook}</Text>
          <Text style={styles.wrongCount}>
            {zh.stats.wrongCount(data?.wrongCount ?? 0)}
          </Text>
          <Ionicons color={colors.textMute} name="chevron-forward" size={18} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingLine: {
    height: 2,
    backgroundColor: colors.primary,
    width: '45%',
  },
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  title: { ...type.title, color: colors.text, paddingTop: space.xl },
  overview: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
  },
  metric: { flex: 1, alignItems: 'center', gap: space.xs },
  metricValue: { ...type.display, color: colors.text },
  metricLabel: { ...type.micro, color: colors.textMute, letterSpacing: 1 },
  divider: { width: stroke.hair, height: 42, backgroundColor: colors.border },
  section: {
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  sectionTitle: { ...type.small, color: colors.text, marginBottom: space.md },
  deckList: { gap: space.lg },
  muted: { ...type.caption, color: colors.textMute },
  wrongRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  wrongTitle: { ...type.small, color: colors.text, flex: 1 },
  wrongCount: { ...type.small, color: colors.textDim },
  errorBox: {
    padding: space.md,
    borderWidth: stroke.hair,
    borderColor: colors.danger,
    borderRadius: radius.sm,
  },
  error: { ...type.caption, color: colors.danger },
});
