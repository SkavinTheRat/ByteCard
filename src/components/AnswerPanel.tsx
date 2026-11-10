import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import type { GradeResult } from '@/cards';
import type { Card } from '@/types';
import { useAIExplanation } from '@/hooks/useAIExplanation';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

type AnswerPanelProps = {
  result: GradeResult;
  explain: string;
  tags: string[];
  elapsedMs: number;
  card: Card;
  userAnswer: string;
};

export function AnswerPanel({
  result,
  explain,
  tags,
  elapsedMs,
  card,
  userAnswer,
}: AnswerPanelProps) {
  const ai = useAIExplanation(card, userAnswer);
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
      <View style={styles.tagsRow}>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.aiActions}>
        <Pressable
          accessibilityRole="button"
          disabled={ai.loading || ai.limitReached}
          hitSlop={8}
          onPress={() => void ai.run('rephrase')}
        >
          <Text style={[styles.aiText, (ai.loading || ai.limitReached) && styles.disabled]}>
            {ai.loading ? zh.ai.thinking : zh.ai.rephrase}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={ai.loading || ai.limitReached}
          hitSlop={8}
          onPress={() => void ai.run('example')}
        >
          <Text style={[styles.aiText, (ai.loading || ai.limitReached) && styles.disabled]}>
            {zh.ai.example}
          </Text>
        </Pressable>
      </View>
      {ai.limitReached ? <Text style={styles.aiError}>{zh.ai.limit}</Text> : null}
      {ai.error ? (
        <View style={styles.aiBox}>
          <Text style={styles.aiError}>{ai.error}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={ai.retry}>
            <Text style={styles.aiText}>{zh.ai.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {ai.text ? (
        <View style={styles.aiBox}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiLabel}>{zh.ai.supplement}</Text>
            <Text style={styles.aiSource}>
              {ai.source === 'cached'
                ? zh.ai.cached
                : ai.source === 'deepseek'
                  ? zh.ai.deepseek
                  : zh.ai.offline}
            </Text>
          </View>
          <Text style={styles.aiBody}>{ai.text}</Text>
        </View>
      ) : null}
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
  tagsRow: { flexDirection: 'row', alignItems: 'center' },
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
  aiActions: { flexDirection: 'row', gap: space.lg },
  aiText: { ...type.micro, color: colors.primary },
  disabled: { color: colors.textMute },
  aiBox: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.info,
    padding: space.md,
    gap: space.sm,
  },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  aiLabel: { ...type.micro, color: colors.info },
  aiSource: { ...type.micro, color: colors.textMute },
  aiBody: { ...type.small, color: colors.text },
  aiError: { ...type.caption, color: colors.danger },
});
