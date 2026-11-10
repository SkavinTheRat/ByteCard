import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KnowledgeCard } from '@/components/KnowledgeCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  getWrongCard,
  requeueWrongCard,
  type WrongCardItem,
} from '@/db/repository';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { colors, radius, space, stroke, type } from '@/theme';

export default function WrongCardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<WrongCardItem | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    void getWrongCard(id)
      .then(setItem)
      .catch((error: unknown) => {
        console.warn('错题详情读取失败', error);
        setFailed(true);
      });
  }, [id]);

  async function requeue() {
    if (!item) {
      return;
    }
    try {
      await requeueWrongCard(item.card.id);
      showToast(zh.wrong.requeued);
      router.back();
    } catch (error: unknown) {
      console.warn('重新入队失败', error);
      showToast(zh.wrong.loadError);
    }
  }

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
        <Text style={styles.title}>{zh.wrong.detailTitle}</Text>
        <View style={styles.spacer} />
      </View>
      {!item ? (
        <View style={styles.center}>
          <Text style={styles.error}>
            {failed ? zh.wrong.loadError : zh.today.loading}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <KnowledgeCard
              accent={colors.info}
              card={item.card}
              deckCode={item.card.deckId.toUpperCase()}
              position={1}
              total={1}
            />
            <View style={styles.explainPanel}>
              <Text style={styles.correct}>{zh.study.revealExplain}</Text>
              <Text style={styles.explain}>{item.card.explain}</Text>
              <View style={styles.tags}>
                {item.card.tags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
          </ScrollView>
          <View
            style={[
              styles.bottom,
              { paddingBottom: Math.max(insets.bottom, space.lg) },
            ]}
          >
            <PrimaryButton
              label={zh.wrong.requeue}
              onPress={() => void requeue()}
            />
          </View>
        </>
      )}
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
  spacer: { width: 24 },
  content: { padding: space.lg, gap: space.md },
  explainPanel: {
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: stroke.hair,
    borderColor: colors.border,
  },
  correct: { ...type.micro, color: colors.primary },
  explain: { ...type.body, color: colors.textDim },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { ...type.micro, color: colors.textMute },
  bottom: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { ...type.body, color: colors.danger },
});
