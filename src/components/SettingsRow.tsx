import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, stroke, type } from '@/theme';

type SettingsRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
  accessory?: ReactNode;
};

export function SettingsRow({
  label,
  value,
  onPress,
  disabled = false,
  last = false,
  accessory,
}: SettingsRowProps) {
  const content = (
    <>
      <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
      {accessory}
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress && !disabled ? (
        <Ionicons color={colors.textMute} name="chevron-forward" size={17} />
      ) : null}
    </>
  );
  if (!onPress) {
    return <View style={[styles.row, !last && styles.border]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.border,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  border: {
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  label: { ...type.small, color: colors.text, flex: 1 },
  disabled: { color: colors.textMute },
  value: { ...type.small, color: colors.textDim },
});
