import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './PrimaryButton';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.lg) },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <PrimaryButton label={confirmLabel} onPress={onConfirm} />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>{zh.common.cancel}</Text>
          </Pressable>
        </View>
      </View>
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
    gap: space.lg,
  },
  title: { ...type.title, color: colors.text },
  message: { ...type.body, color: colors.textDim },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...type.small, color: colors.textDim },
});
