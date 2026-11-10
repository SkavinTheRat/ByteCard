import { StyleSheet, View } from 'react-native';
import type { MultiCard } from '@/types';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { zh } from '@/i18n/zh';
import { space } from '@/theme';
import { draftToIndices, type AnswerViewProps } from '../../registry';

export function MultiAnswerView({
  card,
  phase,
  draft,
  onDraftChange,
  onSubmit,
}: AnswerViewProps<MultiCard>) {
  const selected = draftToIndices(draft);
  const answered = phase === 'revealed';
  const correct = card.answer.indices;

  function toggle(index: number) {
    if (answered) {
      return;
    }
    const next = selected.includes(index)
      ? selected.filter((item) => item !== index)
      : [...selected, index];
    onDraftChange(next);
  }

  function stateFor(index: number): OptionState {
    if (!answered) {
      return selected.includes(index) ? 'selected' : 'default';
    }
    const picked = selected.includes(index);
    const answer = correct.includes(index);
    if (picked && answer) {
      return 'correct';
    }
    if (picked && !answer) {
      return 'wrong';
    }
    if (!picked && answer) {
      return 'missed';
    }
    return 'dimmed';
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {card.options.map((option, index) => (
          <OptionButton
            key={`${card.id}-${index}`}
            index={index}
            label={option}
            state={stateFor(index)}
            variant="multi"
            onPress={() => toggle(index)}
          />
        ))}
      </View>
      {!answered ? (
        <PrimaryButton
          label={selected.length === 0 ? zh.study.selectPrompt : zh.study.confirm}
          disabled={selected.length === 0}
          onPress={() => onSubmit({ kind: 'indices', value: selected })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  list: { gap: space.sm },
});
