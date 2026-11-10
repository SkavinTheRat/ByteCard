import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, stroke, type } from '@/theme';

type OptionSheetProps = {
  visible: boolean;
  title: string;
  options: number[];
  selected: number;
  onSelect: (value: number) => void;
  onClose: () => void;
};

export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.lg) },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.option, option === selected && styles.selected]}
            >
              <Text
                style={[
                  styles.optionText,
                  option === selected && styles.selectedText,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderColor: colors.borderStrong,
    borderWidth: stroke.hair,
    padding: space.xl,
    gap: space.sm,
  },
  title: { ...type.title, color: colors.text, marginBottom: space.sm },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primarySoft },
  optionText: { ...type.body, color: colors.text },
  selectedText: { color: colors.primary },
});
