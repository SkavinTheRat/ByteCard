import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWrongCards, type WrongCardItem } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

function wrongTime(value: string | null): string {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export default function WrongBookScreen() {
  const [items, setItems] = useState<WrongCardItem[]>([]);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getWrongCards(200)
        .then((rows) => {
          setItems(rows);
          setFailed(false);
        })
        .catch((error: unknown) => {
          console.warn('错题读取失败', error);
          setFailed(true);
        });
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={zh.common.back}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
        >
          <Ionicons color={colors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>{zh.wrong.title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {failed ? <Text style={styles.error}>{zh.wrong.loadError}</Text> : null}
        {items.length === 0 && !failed ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{zh.wrong.empty}</Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.card.id}
              onPress={() =>
                router.push({
                  pathname: '/wrong/[id]',
                  params: { id: item.card.id },
                })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowBody}>
                <Text style={styles.deck}>{item.card.deckId.toUpperCase()}</Text>
                <Text numberOfLines={2} style={styles.question}>
                  {item.card.question}
                </Text>
                <Text style={styles.meta}>
                  {zh.wrong.lapses(item.lapses)} ·{' '}
                  {zh.wrong.lastWrong(wrongTime(item.lastWrongAt))}
                </Text>
              </View>
              <Ionicons color={colors.textMute} name="chevron-forward" size={18} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  title: { ...type.title, color: colors.text, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 24 },
  content: { padding: space.lg, gap: space.sm },
  empty: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.body, color: colors.textDim },
  error: { ...type.caption, color: colors.danger },
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  rowBody: { flex: 1, gap: space.xs },
  deck: { ...type.micro, color: colors.primary },
  question: { ...type.small, color: colors.text },
  meta: { ...type.micro, color: colors.textMute },
});
