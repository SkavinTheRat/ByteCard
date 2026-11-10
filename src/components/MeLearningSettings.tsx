import { Switch, Text, View } from 'react-native';
import { meStyles as styles } from './MeSettingsStyles';
import { SettingsRow } from './SettingsRow';
import { zh } from '@/i18n/zh';
import { colors } from '@/theme';
import type { Deck } from '@/types';

export type LimitKey = 'daily_new_limit' | 'daily_review_limit';
export type LimitSelector = {
  key: LimitKey;
  title: string;
  options: number[];
  value: number;
};

type Props = {
  decks: Deck[];
  enabled: Set<string>;
  newLimit: number;
  reviewLimit: number;
  reminderEnabled: boolean;
  reminderTime: string;
  onLimit: (key: LimitKey) => void;
  onDeck: (id: string, value: boolean) => void;
  onReminder: (value: boolean) => void;
};

export function MeLearningSettings({
  decks,
  enabled,
  newLimit,
  reviewLimit,
  reminderEnabled,
  reminderTime,
  onLimit,
  onDeck,
  onReminder,
}: Props) {
  return (
    <>
      <Text style={styles.group}>{zh.me.learning}</Text>
      <View style={styles.panel}>
        <SettingsRow
          label={zh.me.dailyNew}
          value={String(newLimit)}
          onPress={() => onLimit('daily_new_limit')}
        />
        <SettingsRow
          label={zh.me.dailyReview}
          value={String(reviewLimit)}
          onPress={() => onLimit('daily_review_limit')}
        />
        <SettingsRow label={zh.me.decks} last={decks.length === 0} />
        {decks.map((deck, index) => (
          <SettingsRow
            accessory={
              <Switch
                onValueChange={(value) => onDeck(deck.id, value)}
                thumbColor={enabled.has(deck.id) ? colors.primary : colors.textMute}
                trackColor={{ false: colors.border, true: colors.primaryDim }}
                value={enabled.has(deck.id)}
              />
            }
            key={deck.id}
            label={`${deck.code} ${deck.name}`}
            last={index === decks.length - 1}
          />
        ))}
        <SettingsRow
          accessory={
            <Switch
              onValueChange={onReminder}
              thumbColor={reminderEnabled ? colors.primary : colors.textMute}
              trackColor={{ false: colors.border, true: colors.primaryDim }}
              value={reminderEnabled}
            />
          }
          label={zh.me.reminder}
          last
          value={reminderTime}
        />
      </View>
    </>
  );
}
