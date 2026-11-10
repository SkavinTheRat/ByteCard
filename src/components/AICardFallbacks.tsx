import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from './PrimaryButton';
import { aiCardStyles as styles } from './AICardStyles';
import { zh } from '@/i18n/zh';
import { colors } from '@/theme';

export function AICardLoading({
  slow,
  onClose,
}: {
  slow: boolean;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.generating}>{zh.aiCard.generating}</Text>
        <View style={styles.dots}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.dot, { opacity: 0.35 + index * 0.25 }]} />
          ))}
        </View>
        <Text style={styles.hint}>{slow ? zh.aiCard.slow : zh.aiCard.loadingHint}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
        <Ionicons color={colors.textDim} name="close" size={24} />
      </Pressable>
    </SafeAreaView>
  );
}

export function AICardFailure({
  message,
  uncertain,
  onRetry,
  onBack,
}: {
  message: string;
  uncertain: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>{zh.aiCard.loadFailed}</Text>
        <Text style={styles.errorBody}>
          {uncertain ? zh.aiCard.skipped : message}
        </Text>
        <PrimaryButton
          label={uncertain ? zh.aiCard.change : zh.aiCard.retry}
          onPress={onRetry}
        />
        <PrimaryButton label={zh.aiCard.directBack} onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}
