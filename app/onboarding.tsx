import { useEffect, useState, type ComponentProps } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listDecks, setSetting } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { useSettingsStore } from '@/store/settingsStore';
import { showToast } from '@/store/toastStore';
import { colors, fonts, radius, space, stroke, type } from '@/theme';
import type { Deck } from '@/types';

const pageKeys = ['intro', 'how', 'decks'] as const;

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setOnboarded = useSettingsStore((state) => state.setOnboarded);
  const [page, setPage] = useState(0);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listDecks()
      .then((rows) => {
        setDecks(rows);
        setSelected(
          new Set(
            rows
              .map((deck) => deck.id)
              .filter((id) => ['ds', 'co', 'os', 'cn', 'ai', 'agent'].includes(id)),
          ),
        );
      })
      .catch((error: unknown) => {
        console.warn('引导页学科读取失败', error);
      });
  }, []);

  function toggleDeck(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  async function start() {
    if (selected.size === 0 || saving) {
      showToast(zh.onboarding.selectOne);
      return;
    }
    setSaving(true);
    try {
      await setSetting('enabled_decks', JSON.stringify([...selected]));
      await setSetting('onboarded', 'true');
      setOnboarded(true);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      console.warn('引导设置保存失败', error);
      showToast(zh.me.loadError);
    } finally {
      setSaving(false);
    }
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={pageKeys}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        horizontal
        keyExtractor={(item) => item}
        onMomentumScrollEnd={onScrollEnd}
        pagingEnabled
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width }]}>
            <Text style={styles.step}>{`0${index + 1} / 03`}</Text>
            {item === 'intro' ? (
              <View style={styles.center}>
                <Text style={styles.hero}>{zh.onboarding.introTitle}</Text>
                <Text style={styles.body}>{zh.onboarding.introBody}</Text>
              </View>
            ) : null}
            {item === 'how' ? (
              <View style={styles.center}>
                <Text style={styles.heroSmall}>{zh.onboarding.howTitle}</Text>
                {[
                  ['albums-outline', zh.onboarding.stepReview],
                  ['terminal-outline', zh.onboarding.stepAnswer],
                  ['refresh-outline', zh.onboarding.stepSrs],
                ].map(([icon, text]) => (
                  <View key={text} style={styles.howRow}>
                    <Ionicons
                      color={colors.primary}
                      name={icon as ComponentProps<typeof Ionicons>['name']}
                      size={22}
                    />
                    <Text style={styles.howText}>{text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {item === 'decks' ? (
              <ScrollView
                contentContainerStyle={styles.deckPage}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.heroSmall}>{zh.onboarding.deckTitle}</Text>
                <Text style={styles.body}>{zh.onboarding.deckBody}</Text>
                <View style={styles.deckGrid}>
                  {decks.map((deck) => {
                    const active = selected.has(deck.id);
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        key={deck.id}
                        onPress={() => toggleDeck(deck.id)}
                        style={[
                          styles.deck,
                          active && {
                            borderColor: deck.accent,
                            backgroundColor: colors.primarySoft,
                          },
                        ]}
                      >
                        <Text style={[styles.deckCode, { color: deck.accent }]}>
                          {deck.code}
                        </Text>
                        <Text style={styles.deckName}>{deck.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <View style={styles.dots}>
          {pageKeys.map((key, index) => (
            <View
              key={key}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>
        {page === 2 ? (
          <PrimaryButton
            disabled={saving || selected.size === 0}
            label={saving ? zh.onboarding.saving : zh.onboarding.start}
            onPress={() => void start()}
          />
        ) : (
          <Text style={styles.swipe}>向左滑动</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  page: { flex: 1, paddingHorizontal: space.xxl, paddingTop: space.xxl },
  step: { ...type.micro, color: colors.primary },
  center: { flex: 1, justifyContent: 'center', gap: space.xl },
  hero: { ...type.display, color: colors.text },
  heroSmall: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textDim },
  howRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  howText: { ...type.body, color: colors.text, flex: 1 },
  deckPage: { flex: 1, justifyContent: 'center', gap: space.lg },
  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  deck: {
    width: '48%',
    minHeight: 86,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
  deckCode: { ...type.micro, fontFamily: fonts.monoBold },
  deckName: { ...type.small, color: colors.text },
  footer: {
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    gap: space.lg,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  dotActive: { width: 20, backgroundColor: colors.primary },
  swipe: { ...type.micro, color: colors.textMute, textAlign: 'center', minHeight: 54 },
});
