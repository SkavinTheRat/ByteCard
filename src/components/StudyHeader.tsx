import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Deck } from '@/types';
import { zh } from '@/i18n/zh';
import { colors, space, stroke, type } from '@/theme';

type StudyHeaderProps = {
  deck: Deck;
  position: number;
  total: number;
  onClose: () => void;
};

export function StudyHeader({
  deck,
  position,
  total,
  onClose,
}: StudyHeaderProps) {
  const progress = useSharedValue(total > 0 ? position / total : 0);
  useEffect(() => {
    progress.value = withTiming(total > 0 ? position / total : 0, {
      duration: 220,
    });
  }, [position, progress, total]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.deckLine}>
          <Text style={[styles.code, { color: deck.accent }]}>{deck.code}</Text>
          <Text numberOfLines={1} style={styles.name}>
            {deck.name}
          </Text>
        </View>
        <Text style={styles.counter}>{zh.study.progress(position, total)}</Text>
        <Pressable
          accessibilityLabel={zh.common.close}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={styles.close}
        >
          <Ionicons color={colors.textDim} name="close" size={24} />
        </Pressable>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, progressStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  deckLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  code: { ...type.micro, fontWeight: '700' },
  name: { ...type.small, color: colors.textDim, flexShrink: 1 },
  counter: { ...type.micro, color: colors.textDim },
  close: { padding: space.xs },
  track: {
    height: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: stroke.thick, backgroundColor: colors.primary },
});
