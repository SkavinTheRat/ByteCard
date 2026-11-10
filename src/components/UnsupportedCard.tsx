import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '@/types';
import { PrimaryButton } from './PrimaryButton';
import { zh } from '@/i18n/zh';
import { colors, radius, space, type } from '@/theme';

export function UnsupportedCard({
  card,
  onSkip,
}: {
  card: Card;
  onSkip: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{zh.study.unsupported}</Text>
      <Text style={styles.id}>{card.id}</Text>
      <PrimaryButton label={zh.study.skip} onPress={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  title: { ...type.body, color: colors.warning },
  id: { ...type.micro, color: colors.textMute },
});
