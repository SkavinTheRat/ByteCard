import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { getLibrarySummary } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, radius, space, stroke, type } from '@/theme';

export default function MeScreen() {
  const [summary, setSummary] = useState<{ cards: number; decks: number } | null>(
    null,
  );
  const ready = useSettingsStore((state) => state.ready);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void getLibrarySummary()
      .then(setSummary)
      .catch((error: unknown) => {
        console.warn('题库摘要读取失败', error);
      });
  }, [ready]);

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>{zh.me.title}</Text>
        <Text style={styles.description}>{zh.me.description}</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>{zh.me.libraryTitle}</Text>
          <Text style={styles.value}>
            {summary
              ? zh.me.libraryValue(summary.cards, summary.decks)
              : zh.today.loading}
          </Text>
        </View>
        <Text style={styles.note}>{zh.me.storageNote}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: space.xxxl, gap: space.lg },
  title: { ...type.title, color: colors.text },
  description: { ...type.small, color: colors.textDim },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  label: { ...type.micro, color: colors.textMute },
  value: { ...type.body, color: colors.text },
  note: { ...type.caption, color: colors.textMute },
});
