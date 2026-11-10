import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  tone = 'primary',
}: PrimaryButtonProps) {
  const backgroundColor =
    disabled || tone === 'danger' ? colors.surfaceHigh : colors.primary;
  const textColor =
    disabled
      ? colors.textMute
      : tone === 'danger'
        ? colors.danger
        : colors.bg;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        tone === 'danger' && styles.dangerBorder,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View pointerEvents="none">
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  dangerBorder: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pressed: { opacity: 0.82 },
  label: {
    ...type.small,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
});
