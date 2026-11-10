import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { DailyStat } from '@/types';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';
import { todayKey } from '@/utils/date';

type HeatmapProps = {
  data: DailyStat[];
};

function localDateOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(day: string): string {
  const [, month, date] = day.split('-');
  return `${Number(month)} 月 ${Number(date)} 日`;
}

function heatColor(done: number): string {
  if (done === 0) {
    return colors.border;
  }
  if (done <= 4) {
    return colors.heat.low;
  }
  if (done <= 9) {
    return colors.heat.medium;
  }
  if (done <= 19) {
    return colors.heat.high;
  }
  return colors.heat.max;
}

export function Heatmap({ data }: HeatmapProps) {
  const [selected, setSelected] = useState<DailyStat | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byDay = new Map(data.map((item) => [item.day, item]));
  const today = todayKey();
  const cells = Array.from({ length: 35 }, (_, index) => {
    const day = localDateOffset(index - 34);
    const date = new Date(`${day}T12:00:00`);
    return {
      day,
      slot: Math.floor(index / 7) * 7 + date.getDay(),
      stat: byDay.get(day) ?? { day, done: 0, correct: 0 },
    };
  });
  const hasData = data.some((item) => item.done > 0);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function select(stat: DailyStat) {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setSelected(stat);
    timer.current = setTimeout(() => setSelected(null), 3000);
  }

  return (
    <View style={styles.container}>
      {!hasData ? <Text style={styles.empty}>{zh.stats.heatmapEmpty}</Text> : null}
      <View style={styles.grid}>
        {cells.map(({ day, slot, stat }) => (
          <Pressable
            accessibilityLabel={`${dayLabel(day)}，${stat.done} 张`}
            accessibilityRole="button"
            key={day}
            onPress={() => select(stat)}
            style={[
              styles.cell,
              {
                backgroundColor: heatColor(stat.done),
                position: 'absolute',
                left: (slot % 7) * 16,
                top: Math.floor(slot / 7) * 16,
              },
              day === today && styles.today,
            ]}
          />
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>{zh.stats.recent35}</Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>{zh.stats.less}</Text>
          {[0, 3, 7, 15, 24].map((value) => (
            <View
              key={value}
              style={[styles.legendCell, { backgroundColor: heatColor(value) }]}
            />
          ))}
          <Text style={styles.legendText}>{zh.stats.more}</Text>
        </View>
      </View>
      {selected ? (
        <Pressable onPress={() => setSelected(null)} style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {zh.stats.dayDetail(dayLabel(selected.day), selected.done, selected.correct)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  grid: { width: 108, height: 76, alignSelf: 'center', position: 'relative' },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  today: {
    borderWidth: stroke.hair,
    borderColor: colors.text,
  },
  empty: {
    ...type.caption,
    color: colors.textDim,
    textAlign: 'center',
    position: 'absolute',
    alignSelf: 'center',
    top: space.xxxl,
    zIndex: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendCell: { width: 8, height: 8, borderRadius: 2 },
  legendText: { ...type.micro, color: colors.textMute },
  bubble: {
    position: 'absolute',
    top: 94,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderStrong,
    borderWidth: stroke.hair,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  bubbleText: { ...type.caption, color: colors.text, textAlign: 'center' },
});
