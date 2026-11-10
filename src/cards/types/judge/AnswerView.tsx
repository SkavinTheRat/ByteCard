import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { JudgeCard } from '@/types';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';
import { draftToIndices, type AnswerViewProps } from '../../registry';

export function JudgeAnswerView({
  card,
  phase,
  draft,
  onDraftChange,
  onSubmit,
}: AnswerViewProps<JudgeCard>) {
  const selected = draftToIndices(draft)[0];
  const answered = phase === 'revealed';

  function stateFor(index: number): 'correct' | 'wrong' | 'dimmed' | 'default' {
    if (!answered) {
      return selected === index ? 'correct' : 'default';
    }
    if (selected === index) {
      return index === (card.answer.value ? 0 : 1) ? 'correct' : 'wrong';
    }
    return index === (card.answer.value ? 0 : 1) ? 'correct' : 'dimmed';
  }

  function choose(index: number) {
    if (answered) {
      return;
    }
    onDraftChange([index]);
    onSubmit({ kind: 'index', value: index });
  }

  return (
    <View style={styles.list}>
      {[
        { index: 0, icon: 'checkmark' as const, label: zh.judge.true, tone: colors.success },
        { index: 1, icon: 'close' as const, label: zh.judge.false, tone: colors.danger },
      ].map((item) => {
        const state = stateFor(item.index);
        const active = state === 'correct' || state === 'wrong';
        return (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => choose(item.index)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: active ? item.tone : colors.border },
              state === 'correct' && styles.correct,
              state === 'wrong' && styles.wrong,
              state === 'dimmed' && styles.dimmed,
              pressed && !answered && styles.pressed,
            ]}
          >
            <Ionicons color={active ? item.tone : colors.textDim} name={item.icon} size={26} />
            <Text style={[styles.label, active && { color: item.tone }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  button: {
    minHeight: 88,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderWidth: stroke.thin,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  correct: { backgroundColor: colors.successSoft },
  wrong: { backgroundColor: colors.dangerSoft },
  dimmed: { opacity: 0.3 },
  pressed: { backgroundColor: colors.surfaceHigh },
  label: { ...type.title, color: colors.text },
});
