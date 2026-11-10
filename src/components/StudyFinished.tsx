import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { Screen } from './Screen';
import { getNextDueSummary } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { colors, space, type } from '@/theme';

type StudyFinishedProps = {
  correct: number;
  total: number;
  unsaved: number;
  empty?: boolean;
  onAgain: () => void;
  onHome: () => void;
};

function evaluation(accuracy: number): string {
  if (accuracy >= 0.8) {
    return zh.study.praiseHigh;
  }
  if (accuracy >= 0.6) {
    return zh.study.praiseMid;
  }
  return zh.study.praiseLow;
}

export function StudyFinished({
  correct,
  total,
  unsaved,
  empty = false,
  onAgain,
  onHome,
}: StudyFinishedProps) {
  const accuracy = total > 0 ? correct / total : 0;
  const [tomorrow, setTomorrow] = useState<number | null>(null);

  useEffect(() => {
    void getNextDueSummary()
      .then((summary) => setTomorrow(summary.tomorrow))
      .catch((error: unknown) => {
        console.warn('下次复习摘要读取失败', error);
      });
  }, []);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.center}>
          <Text style={styles.eyebrow}>{zh.study.resultTitle}</Text>
          <Text style={styles.score}>
            {empty ? '0 / 0' : zh.study.accuracy(correct, total)}
          </Text>
          <Text style={styles.message}>
            {empty ? zh.study.emptyTitle : evaluation(accuracy)}
          </Text>
          {empty ? <Text style={styles.emptyBody}>{zh.study.emptyBody}</Text> : null}
          {tomorrow !== null ? (
            <Text style={styles.nextReview}>
              {tomorrow > 0
                ? zh.study.nextReview(tomorrow)
                : zh.study.nextReviewEmpty}
            </Text>
          ) : null}
          {unsaved > 0 ? (
            <Text style={styles.unsaved}>{zh.study.unsaved(unsaved)}</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <PrimaryButton label={zh.study.again} onPress={onAgain} />
          <PrimaryButton
            label={zh.study.home}
            onPress={onHome}
            tone="danger"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingVertical: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  eyebrow: { ...type.micro, color: colors.textMute },
  score: { ...type.display, color: colors.primary },
  message: { ...type.title, color: colors.text, textAlign: 'center' },
  emptyBody: { ...type.small, color: colors.textDim, textAlign: 'center' },
  nextReview: { ...type.caption, color: colors.textDim },
  unsaved: { ...type.caption, color: colors.warning },
  actions: { gap: space.md },
});
