import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme';

export function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.block, styles.short]} />
      <View style={[styles.block, styles.ring]} />
      <View style={[styles.block, styles.button]} />
      <View style={[styles.block, styles.medium]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', gap: space.xl },
  block: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  short: { width: 132, height: 16 },
  ring: { width: 168, height: 168, borderRadius: radius.pill },
  button: { width: '100%', height: 54 },
  medium: { width: 188, height: 14 },
});
