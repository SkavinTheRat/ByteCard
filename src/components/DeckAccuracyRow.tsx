import { StyleSheet, Text, View } from 'react-native';
import type { DeckAccuracy } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

export function DeckAccuracyRow({ item }: { item: DeckAccuracy }) {
  const percent = Math.round(item.accuracy * 100);
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={[styles.code, { color: item.accent }]}>{item.code}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: item.accent,
              width: `${Math.max(0, Math.min(100, percent))}%`,
            },
          ]}
        />
      </View>
      <Text style={styles.done}>{zh.stats.deckDone(item.done)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  code: { ...type.micro, width: 64 },
  name: { ...type.small, color: colors.text, flex: 1 },
  percent: { ...type.micro, color: colors.textDim },
  track: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: radius.pill },
  done: { ...type.micro, color: colors.textMute },
});
