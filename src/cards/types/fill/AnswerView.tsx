import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { FillCard } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { zh } from '@/i18n/zh';
import { colors, fonts, radius, space, stroke, type } from '@/theme';
import { draftToText, type AnswerViewProps } from '../../registry';

export function FillAnswerView({
  card,
  phase,
  draft,
  onDraftChange,
  onSubmit,
  onInputFocus,
}: AnswerViewProps<FillCard>) {
  const value = draftToText(draft);
  const answered = phase === 'revealed';

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel={zh.study.fillPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!answered}
        keyboardAppearance="dark"
        placeholder={zh.study.fillPlaceholder}
        placeholderTextColor={colors.textMute}
        selectionColor={colors.primary}
        style={styles.input}
        value={value}
        onChangeText={onDraftChange}
        onFocus={onInputFocus}
      />
      {card.answer.hint ? (
        <Text style={styles.hint}>{zh.study.fillHint(card.answer.hint)}</Text>
      ) : null}
      {!answered ? (
        <PrimaryButton
          label={zh.study.submit}
          disabled={value.trim().length === 0}
          onPress={() => onSubmit({ kind: 'text', value })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  input: {
    minHeight: 52,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.md,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: type.body.fontSize,
    paddingHorizontal: space.lg,
  },
  hint: {
    ...type.caption,
    color: colors.textMute,
    marginTop: -space.xs,
  },
});
