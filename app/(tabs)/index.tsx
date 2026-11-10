import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { getLibrarySummary, getTodayStats } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, space, type } from '@/theme';
import { formatChineseDate } from '@/utils/date';

type Dashboard = {
  cards: number;
  decks: number;
  done: number;
  goal: number;
  due: number;
  newCards: number;
  cleared: boolean;
};

export default function TodayScreen() {
  const ready = useSettingsStore((state) => state.ready);
  const initializationError = useSettingsStore((state) => state.error);
  const initialize = useSettingsStore((state) => state.initialize);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!ready) {
      return;
    }
    setLoadError(false);
    try {
      const [summary, stats] = await Promise.all([
        getLibrarySummary(),
        getTodayStats(),
      ]);
      setDashboard({
        cards: summary.cards,
        decks: summary.decks,
        done: stats.done,
        goal: stats.goal,
        due: stats.due,
        newCards: stats.newCards,
        cleared: stats.cleared,
      });
    } catch (error: unknown) {
      console.warn('首页数据读取失败', error);
      setLoadError(true);
    }
  }, [ready]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function retry() {
    setDashboard(null);
    void initialize();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{zh.today.eyebrow}</Text>
          <Text style={styles.brand}>{zh.today.title}</Text>
        </View>
        <Text style={styles.date}>{formatChineseDate()}</Text>
      </View>

      {!dashboard ? (
        loadError || initializationError ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={retry}
            style={styles.centered}
          >
            <Text style={styles.error}>{zh.today.loadError}</Text>
          </Pressable>
        ) : (
          <LoadingSkeleton />
        )
      ) : (
        <>
          <View style={styles.center}>
            <ProgressRing done={dashboard.done} target={dashboard.goal} />
            <Text style={styles.subtitle}>
              {dashboard.cleared ? zh.today.cleared : zh.today.subtitle}
            </Text>
            <Text style={styles.queueStatus}>
              {zh.today.queueStatus(dashboard.due, dashboard.newCards)}
            </Text>
          </View>
          <View style={styles.footer}>
            <PrimaryButton
              label={dashboard.done > 0 ? zh.today.resume : zh.today.start}
              disabled={dashboard.cards === 0 || dashboard.cleared}
              onPress={() => router.push('/study')}
            />
            <Text style={styles.library}>
              {zh.today.library(dashboard.cards, dashboard.decks)}
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: { ...type.micro, color: colors.textMute },
  brand: {
    ...type.display,
    color: colors.text,
    letterSpacing: 2,
    marginTop: space.xs,
  },
  date: { ...type.caption, color: colors.textDim, paddingTop: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  subtitle: { ...type.small, color: colors.textDim },
  queueStatus: { ...type.micro, color: colors.textDim },
  footer: { gap: space.md, paddingBottom: space.xl },
  library: { ...type.micro, color: colors.textMute, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { ...type.body, color: colors.danger, textAlign: 'center' },
});
