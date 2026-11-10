import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './PrimaryButton';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

type EndSessionSheetProps = {
  visible: boolean;
  doneCount: number;
  onKeepLearning: () => void;
  onEnd: () => void;
};

export function EndSessionSheet({
  visible,
  doneCount,
  onKeepLearning,
  onEnd,
}: EndSessionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onKeepLearning}
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
          <Text style={styles.title}>{zh.study.closeTitle}</Text>
          <Text style={styles.body}>{zh.study.closeBody(doneCount)}</Text>
          <PrimaryButton
            label={zh.study.keepLearning}
            onPress={onKeepLearning}
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEnd}
            style={styles.endButton}
          >
            <Text style={styles.endText}>{zh.study.end}</Text>
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
  body: { ...type.body, color: colors.textDim },
  endButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  endText: { ...type.small, color: colors.danger },
});
