import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { zh } from '@/i18n/zh';
import { colors, fonts, radius, space, stroke, type } from '@/theme';

export type OptionState =
  | 'default'
  | 'selected'
  | 'correct'
  | 'wrong'
  | 'missed'
  | 'dimmed';

type OptionButtonProps = {
  index: number;
  label: string;
  state: OptionState;
  variant: 'single' | 'multi';
  onPress: () => void;
};

const stateColors: Record<
  OptionState,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.text,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    color: colors.text,
  },
  correct: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    color: colors.text,
  },
  wrong: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    color: colors.text,
  },
  missed: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
    color: colors.text,
  },
  dimmed: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.textDim,
  },
};

function Marker({
  index,
  state,
  variant,
}: {
  index: number;
  state: OptionState;
  variant: 'single' | 'multi';
}) {
  if (state === 'correct') {
    return <Ionicons color={colors.success} name="checkmark" size={16} />;
  }
  if (state === 'wrong') {
    return <Ionicons color={colors.danger} name="close" size={16} />;
  }
  if (state === 'missed') {
    return <Ionicons color={colors.success} name="checkbox-outline" size={15} />;
  }
  if (state === 'selected' && variant === 'multi') {
    return <Ionicons color={colors.primary} name="checkmark" size={16} />;
  }
  return <Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text>;
}

export const OptionButton = memo(function OptionButton({
  index,
  label,
  state,
  variant,
  onPress,
}: OptionButtonProps) {
  const palette = stateColors[state];
  return (
    <Pressable
      accessibilityLabel={`${zh.option.label(index)}：${label}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: state === 'dimmed' ? 0.4 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.marker,
          variant === 'multi' && styles.squareMarker,
          state === 'selected' && styles.selectedMarker,
          state === 'correct' && styles.correctMarker,
          state === 'wrong' && styles.wrongMarker,
          state === 'missed' && styles.missedMarker,
        ]}
      >
        <Marker index={index} state={state} variant={variant} />
      </View>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: stroke.hair,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  marker: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  squareMarker: { borderRadius: 5 },
  selectedMarker: { borderColor: colors.primary },
  correctMarker: { borderColor: colors.success },
  wrongMarker: { borderColor: colors.danger },
  missedMarker: { borderColor: colors.success },
  letter: {
    ...type.micro,
    color: colors.textDim,
    fontFamily: fonts.mono,
  },
  label: {
    ...type.body,
    flex: 1,
  },
});
