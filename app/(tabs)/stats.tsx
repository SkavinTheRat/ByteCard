import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { zh } from '@/i18n/zh';
import { colors, space, type } from '@/theme';

export default function StatsScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>{zh.stats.title}</Text>
        <Text style={styles.description}>{zh.stats.description}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  title: { ...type.title, color: colors.text },
  description: {
    ...type.small,
    color: colors.textDim,
    textAlign: 'center',
    maxWidth: 280,
  },
});
