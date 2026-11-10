import { PixelRatio, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { meStyles as styles } from './MeSettingsStyles';
import { SettingsRow } from './SettingsRow';
import { zh } from '@/i18n/zh';

type Props = {
  cards: number;
  decks: number;
  onReset: () => void;
  onAISettings: () => void;
  onClearAI: () => void;
  onShiftDue: () => void;
  onRegenerate: () => void;
  onAICards: () => void;
  aiGeneration: string;
  onDeckUpdate: () => void;
};

export function MeDataSettings({
  cards,
  decks,
  onReset,
  onAISettings,
  onClearAI,
  onShiftDue,
  onRegenerate,
  onAICards,
  aiGeneration,
  onDeckUpdate,
}: Props) {
  return (
    <>
      <Text style={styles.group}>{zh.me.data}</Text>
      <View style={styles.panel}>
        <SettingsRow disabled label={zh.me.export} />
        <SettingsRow label={zh.me.reset} last onPress={onReset} />
      </View>

      <Text style={styles.group}>AI</Text>
      <View style={styles.panel}>
        <SettingsRow label={zh.me.aiSettings} onPress={onAISettings} />
        <SettingsRow label={zh.me.aiCards} value={aiGeneration} onPress={onAICards} />
        <SettingsRow label={zh.me.clearAICache} last onPress={onClearAI} />
      </View>

      <Text style={styles.group}>{zh.me.about}</Text>
      <View style={styles.panel}>
        <SettingsRow
          label={zh.me.version}
          value={Constants.expoConfig?.version ?? 'unknown'}
        />
        <SettingsRow
          label={zh.me.deckLibrary}
          value={zh.me.libraryValue(cards, decks)}
        />
        <SettingsRow label={zh.me.deckUpdate} last onPress={onDeckUpdate} />
      </View>

      {__DEV__ ? (
        <>
          <Text style={styles.group}>{zh.me.developer}</Text>
          <View style={styles.panel}>
            <SettingsRow
              label={zh.me.fontScale}
              value={PixelRatio.getFontScale().toFixed(2)}
            />
            <SettingsRow label={zh.me.shiftDue} onPress={onShiftDue} />
            <SettingsRow label={zh.me.regenerate} last onPress={onRegenerate} />
          </View>
        </>
      ) : null}
      <Text style={styles.description}>{zh.me.appCloneNote}</Text>
    </>
  );
}
