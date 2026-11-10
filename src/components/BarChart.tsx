import { StyleSheet, Text, View } from 'react-native';
import type { DailyStat } from '@/types';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';
import { todayKey } from '@/utils/date';

function dayKey(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function BarChart({ data }: { data: DailyStat[] }) {
  const map = new Map(data.map((item) => [item.day, item]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = dayKey(index - 6);
    return { ...(map.get(day) ?? { day, done: 0, correct: 0 }), isToday: day === todayKey() };
  });
  const max = Math.max(...days.map((item) => item.done), 0);
  const total = days.reduce((sum, item) => sum + item.done, 0);
  const average = total > 0 ? (total / 7).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.total}>{zh.stats.weekTotal(total)}</Text>
        <Text style={styles.average}>{zh.stats.dailyAverage(average)}</Text>
      </View>
      {total === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{zh.stats.chartEmpty}</Text>
        </View>
      ) : (
        <View style={styles.chart}>
          {days.map((item, index) => (
            <View key={item.day} style={styles.column}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(3, (item.done / max) * 92),
                      backgroundColor:
                        item.done >= 15 ? colors.primary : colors.borderStrong,
                    },
                    item.isToday && styles.todayBar,
                  ]}
                />
              </View>
              <Text style={styles.label}>
                {index === 0 ? '前 6 天' : index === 6 ? '今天' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { ...type.micro, color: colors.text },
  average: { ...type.caption, color: colors.textDim },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  column: { flex: 1, alignItems: 'stretch', gap: space.xs },
  track: { height: 96, justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  todayBar: { borderWidth: stroke.hair, borderColor: colors.warning },
  label: { ...type.micro, color: colors.textMute, textAlign: 'center' },
  emptyBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  emptyText: { ...type.caption, color: colors.textMute },
});
