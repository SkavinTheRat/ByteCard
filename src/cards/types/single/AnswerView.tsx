import { StyleSheet, View } from 'react-native';
import type { SingleCard } from '@/types';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { space } from '@/theme';
import { draftToIndices, type AnswerViewProps } from '../../registry';

export function SingleAnswerView({
  card,
  phase,
  draft,
  onDraftChange,
  onSubmit,
}: AnswerViewProps<SingleCard>) {
  const selected = draftToIndices(draft)[0];
  const answered = phase === 'revealed';

  function choose(index: number) {
    if (answered) {
      return;
    }
    onDraftChange([index]);
    onSubmit({ kind: 'index', value: index });
  }

  function stateFor(index: number): OptionState {
    if (!answered) {
      return 'default';
    }
    if (index === card.answer.index) {
      return 'correct';
    }
    if (index === selected) {
      return 'wrong';
    }
    return 'dimmed';
  }

  return (
    <View style={styles.list}>
      {card.options.map((option, index) => (
        <OptionButton
          key={`${card.id}-${index}`}
          index={index}
          label={option}
          state={stateFor(index)}
          variant="single"
          onPress={() => choose(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
