import { Pressable, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { PrimaryButton } from './PrimaryButton';
import { buildAIExport } from '@/utils/aiExport';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { colors, radius, space, stroke, type } from '@/theme';

function exportName(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  return `bytecard-ai-${stamp}.json`;
}

export function AICardExportActions({ count }: { count: number }) {
  if (count === 0) return null;

  async function exportFile() {
    try {
      const exported = await buildAIExport();
      if (exported.count === 0) {
        showToast(zh.aiManage.exportEmpty);
        return;
      }
      const file = new File(Paths.cache, exportName());
      file.create({ overwrite: true, intermediates: true });
      await file.write(exported.text);
      if (!(await Sharing.isAvailableAsync())) {
        showToast(zh.aiManage.exportError);
        return;
      }
      await Sharing.shareAsync(file.uri, {
        dialogTitle: zh.aiManage.export,
        mimeType: 'application/json',
      });
      showToast(zh.aiManage.exported);
    } catch (error: unknown) {
      console.warn('AI 卡导出失败', error);
      showToast(zh.aiManage.exportError);
    }
  }

  async function copyText() {
    try {
      const exported = await buildAIExport();
      if (exported.count === 0) {
        showToast(zh.aiManage.exportEmpty);
        return;
      }
      await Clipboard.setStringAsync(exported.text);
      showToast(zh.aiManage.copied);
    } catch (error: unknown) {
      console.warn('AI 卡复制失败', error);
      showToast(zh.aiManage.exportError);
    }
  }

  return (
    <View style={styles.wrap}>
      <PrimaryButton label={zh.aiManage.export} onPress={() => void exportFile()} />
      <Pressable accessibilityRole="button" onPress={() => void copyText()} style={styles.copy}>
        <Text style={styles.copyText}>{zh.aiManage.copy}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  copy: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  copyText: { ...type.small, color: colors.textDim },
});
