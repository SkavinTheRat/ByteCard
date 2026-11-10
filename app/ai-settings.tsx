import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { testDeepSeekConnection } from '@/ai/deepseek';
import { getSetting, setSetting } from '@/db/repository';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { colors, fonts, radius, space, stroke, type } from '@/theme';

export default function AISettingsScreen() {
  const [key, setKey] = useState('');
  const [model, setModel] = useState('deepseek-chat');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    void Promise.all([
      getSetting('ai_api_key'),
      getSetting('ai_model'),
      getSetting('ai_base_url'),
    ])
      .then(([savedKey, savedModel, savedBase]) => {
        setKey(savedKey ?? '');
        setModel(savedModel ?? 'deepseek-chat');
        setBaseUrl(savedBase ?? 'https://api.deepseek.com');
      })
      .catch((error: unknown) => {
        console.warn('AI 设置读取失败', error);
      });
  }, []);

  async function save(name: string, value: string) {
    try {
      await setSetting(name, value.trim());
      showToast(zh.ai.saved);
    } catch (error: unknown) {
      console.warn('AI 设置保存失败', error);
      showToast(zh.me.loadError);
    }
  }

  async function testConnection() {
    if (!key.trim()) {
      setTestState('error');
      setTestMessage(zh.ai.emptyKey);
      return;
    }
    setTesting(true);
    setTestState(null);
    try {
      await testDeepSeekConnection({
        key: key.trim(),
        model: model.trim(),
        baseUrl: baseUrl.trim(),
      });
      setTestState('success');
      setTestMessage(zh.ai.testSuccess);
    } catch (error: unknown) {
      setTestState('error');
      setTestMessage(error instanceof Error ? error.message : zh.ai.requestFailed);
    } finally {
      setTesting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={zh.common.back}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
        >
          <Ionicons color={colors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>{zh.ai.settingsTitle}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{zh.ai.apiKey}</Text>
        <View style={styles.keyRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            onBlur={() => void save('ai_api_key', key)}
            onChangeText={setKey}
            placeholder={zh.ai.apiKeyPlaceholder}
            placeholderTextColor={colors.textMute}
            secureTextEntry={!showKey}
            selectionColor={colors.primary}
            style={[styles.input, styles.keyInput]}
            value={key}
          />
          <Pressable
            accessibilityLabel={showKey ? '隐藏 Key' : '显示 Key'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setShowKey((value) => !value)}
            style={styles.eye}
          >
            <Ionicons
              color={colors.textDim}
              name={showKey ? 'eye-off-outline' : 'eye-outline'}
              size={21}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>{zh.ai.model}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance="dark"
          onBlur={() => void save('ai_model', model)}
          onChangeText={setModel}
          selectionColor={colors.primary}
          style={styles.input}
          value={model}
        />
        <Text style={styles.hint}>{zh.ai.modelHint}</Text>

        <Text style={styles.label}>{zh.ai.baseUrl}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance="dark"
          keyboardType="url"
          onBlur={() => void save('ai_base_url', baseUrl)}
          onChangeText={setBaseUrl}
          selectionColor={colors.primary}
          style={styles.input}
          value={baseUrl}
        />

        <PrimaryButton
          disabled={testing}
          label={testing ? zh.ai.testing : zh.ai.test}
          onPress={() => void testConnection()}
        />
        {testState ? (
          <Text
            style={[
              styles.testMessage,
              { color: testState === 'success' ? colors.success : colors.danger },
            ]}
          >
            {testMessage}
          </Text>
        ) : null}
        <Text style={styles.security}>{zh.ai.security}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  title: { ...type.title, color: colors.text, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  content: {
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  label: { ...type.small, color: colors.text, marginTop: space.sm },
  keyRow: { position: 'relative' },
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
  keyInput: { paddingRight: 52 },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { ...type.micro, color: colors.textMute },
  testMessage: { ...type.small, textAlign: 'center' },
  security: {
    ...type.caption,
    color: colors.textMute,
    marginTop: space.xl,
  },
});
