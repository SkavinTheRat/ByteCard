import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, space, stroke, type } from '@/theme';

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const visible = useToastStore((state) => state.visible);
  const message = useToastStore((state) => state.message);
  if (!visible) {
    return null;
  }
  return (
    <View pointerEvents="none" style={[styles.layer, { top: insets.top + space.sm }]}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(180)} style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderStrong,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  text: { ...type.small, color: colors.text, textAlign: 'center' },
});
