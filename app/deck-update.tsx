import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getLibrarySummary,
  getSetting,
  setSetting,
} from '@/db/repository';
import { checkRemoteDeckUpdate, type UpdateResult } from '@/db/remoteUpdate';
import { PrimaryButton } from '@/components/PrimaryButton';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { colors, fonts, radius, space, stroke, type } from '@/theme';

export default function DeckUpdateScreen() {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [version, setVersion] = useState(0);
  const [cards, setCards] = useState(0);
  const [checkedAt, setCheckedAt] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [remoteUrl, currentVersion, summary, checked] = await Promise.all([
        getSetting('deck_remote_url'),
        getSetting('deck_version'),
        getLibrarySummary(),
        getSetting('deck_checked_at'),
      ]);
      setUrl(remoteUrl ?? '');
      setVersion(Number(currentVersion ?? 0));
      setCards(summary.cards);
      setCheckedAt(checked ?? '');
      setFailed(false);
    } catch (error: unknown) {
      console.warn('题库更新页读取失败', error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveUrl() {
    try {
      await setSetting('deck_remote_url', url.trim());
      showToast(zh.deckUpdate.saved);
    } catch (error: unknown) {
      console.warn('题库地址保存失败', error);
      showToast(zh.deckUpdate.loadError);
    }
  }

  async function check() {
    setChecking(true);
    try {
      const update = await checkRemoteDeckUpdate();
      setResult(update);
      if (update.status === 'updated') await load();
    } catch (error: unknown) {
      console.warn('手动题库更新失败', error);
      setResult({
        status: 'error',
        version,
        code: 'unknown',
        message: zh.deckUpdate.unreachable,
      });
    } finally {
      setChecking(false);
    }
  }

  function resultText(): string | null {
    if (!result) return null;
    if (result.status === 'up-to-date') return zh.deckUpdate.upToDate(result.version);
    if (result.status === 'updated') return zh.deckUpdate.updated(result.added, result.removed);
    if (result.status === 'disabled') return zh.deckUpdate.disabled;
    if (result.status === 'deferred') return zh.deckUpdate.deferred;
    if (result.status === 'error' && result.code.startsWith('invalid')) {
      return zh.deckUpdate.invalid;
    }
    return zh.deckUpdate.unreachable;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
          <Ionicons color={colors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>{zh.deckUpdate.title}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.xxxl },
        ]}
      >
        {failed ? <Text style={styles.error}>{zh.deckUpdate.loadError}</Text> : null}
        <View style={styles.panel}>
          <Text style={styles.value}>{zh.deckUpdate.current(version, cards)}</Text>
          <Text style={styles.meta}>{zh.deckUpdate.checked(checkedAt)}</Text>
        </View>
        <Text style={styles.label}>{zh.deckUpdate.url}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance="dark"
          keyboardType="url"
          onBlur={() => void saveUrl()}
          onChangeText={setUrl}
          placeholder={zh.deckUpdate.urlPlaceholder}
          placeholderTextColor={colors.textMute}
          selectionColor={colors.primary}
          style={styles.input}
          value={url}
        />
        {checking ? (
          <View style={styles.checking}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.meta}>{zh.deckUpdate.checking}</Text>
          </View>
        ) : (
          <PrimaryButton label={zh.deckUpdate.button} onPress={() => void check()} />
        )}
        {resultText() ? <Text style={styles.result}>{resultText()}</Text> : null}
        <Text style={styles.caption}>{zh.deckUpdate.caption}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center' },
  title: { ...type.title, color: colors.text, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  content: { padding: space.lg, gap: space.lg },
  panel: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderWidth: stroke.hair, borderColor: colors.border, borderRadius: radius.md },
  value: { ...type.small, color: colors.text },
  meta: { ...type.caption, color: colors.textDim },
  label: { ...type.micro, color: colors.textMute },
  input: { minHeight: 52, paddingHorizontal: space.lg, color: colors.text, fontFamily: fonts.mono, fontSize: 13, backgroundColor: colors.surface, borderWidth: stroke.hair, borderColor: colors.border, borderRadius: radius.md },
  checking: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  result: { ...type.small, color: colors.primary },
  caption: { ...type.caption, color: colors.textMute },
  error: { ...type.caption, color: colors.danger },
});
