import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '@/theme';

type ProgressRingProps = {
  done: number;
  target: number;
  size?: number;
};

export function ProgressRing({ done, target, size = 168 }: ProgressRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(done / target, 1) : 0;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg height={size} width={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          stroke={colors.primary}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.done}>{done}</Text>
        <Text style={styles.target}>/ {target}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center' },
  done: { ...type.display, color: colors.primary },
  target: { ...type.caption, color: colors.textMute },
});
