import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StudyFinished } from '@/components/StudyFinished';
import { StudySession } from '@/components/StudySession';
import { buildTodayQueue, listDecks } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, space, type } from '@/theme';
import type { Deck } from '@/types';

type StudyStatus = 'loading' | 'studying' | 'finished' | 'empty' | 'error';

export default function StudyScreen() {
  const ready = useSettingsStore((state) => state.ready);
  const queue = useSessionStore((state) => state.queue);
  const index = useSessionStore((state) => state.index);
  const doneCount = useSessionStore((state) => state.doneCount);
  const correctCount = useSessionStore((state) => state.correctCount);
  const unsavedCount = useSessionStore((state) => state.unsavedCount);
  const start = useSessionStore((state) => state.start);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [status, setStatus] = useState<StudyStatus>('loading');

  const loadSession = useCallback(async () => {
    if (!ready) {
      return;
    }
    setStatus('loading');
    try {
      const [deckRows, cards] = await Promise.all([
        listDecks(),
        buildTodayQueue({ newLimit: 15, reviewLimit: 80 }),
      ]);
      setDecks(deckRows);
      if (cards.length === 0) {
        start([]);
        setStatus('empty');
        return;
      }
      start(cards);
      setStatus('studying');
    } catch (error: unknown) {
      console.warn('学习队列读取失败', error);
      setStatus('error');
    }
  }, [ready, start]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  if (status === 'finished' || status === 'empty') {
    return (
      <StudyFinished
        correct={correctCount}
        empty={status === 'empty'}
        total={doneCount}
        unsaved={unsavedCount}
        onAgain={() => void loadSession()}
        onHome={() => router.replace('/(tabs)')}
      />
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{zh.study.loadError}</Text>
          <PrimaryButton
            label={zh.common.retry}
            onPress={() => void loadSession()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentCard = queue[index];
  const currentDeck = currentCard
    ? decks.find((deck) => deck.id === currentCard.deckId)
    : undefined;

  if (status === 'loading' || !currentCard || !currentDeck) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loading}>{zh.study.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StudySession
      deck={currentDeck}
      onFinish={() => setStatus('finished')}
      onExit={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  loading: { ...type.body, color: colors.textDim },
  error: { ...type.body, color: colors.danger, textAlign: 'center' },
});
