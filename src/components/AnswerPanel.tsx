import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import type { GradeResult } from '@/cards';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

type AnswerPanelProps = {
  result: GradeResult;
  explain: string;
  tags: string[];
  elapsedMs: number;
};

export function AnswerPanel({
  result,
  explain,
  tags,
  elapsedMs,
}: AnswerPanelProps) {
  const near = result.matchedBy === 'near';
  const tone = result.isCorrect
    ? colors.success
    : near
      ? colors.warning
      : colors.danger;
  const icon = result.isCorrect
    ? 'checkmark-circle'
    : near
      ? 'alert-circle'
      : 'close-circle';
  const label = result.isCorrect
    ? zh.study.correct
    : near
      ? zh.study.near
      : zh.study.incorrect;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      layout={LinearTransition.duration(200)}
      style={styles.panel}
      testID="answer-panel"
    >
      <View style={styles.resultLine}>
        <Ionicons color={tone} name={icon} size={18} />
        <Text style={[styles.resultText, { color: tone }]}>{label}</Text>
        <Text style={styles.elapsed}>
          {zh.study.elapsed(Math.max(1, Math.round(elapsedMs / 1000)))}
        </Text>
      </View>
      {result.feedback ? (
        <Text style={[styles.feedback, { color: tone }]}>{result.feedback}</Text>
      ) : null}
      {!result.isCorrect && !near && result.correctText ? (
        <Text style={styles.correctAnswer}>
          {zh.study.correctAnswer}
          {result.correctText}
        </Text>
      ) : null}
      <Text style={styles.explain}>{explain}</Text>
      <View style={styles.footer}>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityLabel={zh.study.aiComingSoon}
          accessibilityRole="button"
          disabled
          hitSlop={8}
          style={styles.aiButton}
        >
          <Text style={styles.aiText}>{zh.study.aiRename}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  resultLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  resultText: { ...type.small, fontWeight: '600' },
  elapsed: { ...type.micro, color: colors.textMute, marginLeft: 'auto' },
  feedback: { ...type.small },
  correctAnswer: { ...type.small, color: colors.success },
  explain: { ...type.small, color: colors.text },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    flex: 1,
  },
  tag: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  tagText: { ...type.micro, color: colors.textDim },
  aiButton: { opacity: 0.45 },
  aiText: { ...type.micro, color: colors.primary },
});
