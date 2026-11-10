import { useCallback, useState } from 'react';
import { Linking, ScrollView, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { OptionSheet } from '@/components/OptionSheet';
import { Screen } from '@/components/Screen';
import { meStyles as styles } from '@/components/MeSettingsStyles';
import { MeLearningSettings, type LimitSelector } from '@/components/MeLearningSettings';
import { MeDataSettings } from '@/components/MeDataSettings';
import {
  advanceAllDueByOneDay,
  clearAICache,
  getLibrarySummary,
  getSetting,
  listDecks,
  resetProgress,
  setSetting,
} from '@/db/repository';
import { zh } from '@/i18n/zh';
import { showToast } from '@/store/toastStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Deck } from '@/types';
import { parseEnabledDecks } from '@/utils/settings';
import {
  disableDailyReminder,
  enableDailyReminder,
} from '@/notifications/reminder';

export default function MeScreen() {
  const ready = useSettingsStore((state) => state.ready);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [newLimit, setNewLimit] = useState(15);
  const [reviewLimit, setReviewLimit] = useState(80);
  const [summary, setSummary] = useState({ cards: 0, decks: 0 });
  const [selector, setSelector] = useState<LimitSelector | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:30');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!ready) {
      return;
    }
    setFailed(false);
    try {
      const [
        deckRows,
        library,
        newValue,
        reviewValue,
        enabledValue,
        reminderValue,
        reminderTimeValue,
      ] =
        await Promise.all([
          listDecks(),
          getLibrarySummary(),
          getSetting('daily_new_limit'),
          getSetting('daily_review_limit'),
          getSetting('enabled_decks'),
          getSetting('reminder_enabled'),
          getSetting('reminder_time'),
        ]);
      setDecks(deckRows);
      setSummary(library);
      setNewLimit(Number(newValue ?? 15));
      setReviewLimit(Number(reviewValue ?? 80));
      setEnabled(parseEnabledDecks(enabledValue));
      setReminderEnabled(reminderValue === 'true');
      setReminderTime(reminderTimeValue ?? '20:30');
    } catch (error: unknown) {
      console.warn('设置读取失败', error);
      setFailed(true);
    }
  }, [ready]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveLimit(key: LimitSelector['key'], value: number) {
    try {
      await setSetting(key, String(value));
      if (key === 'daily_new_limit') {
        setNewLimit(value);
      } else {
        setReviewLimit(value);
      }
      setSelector(null);
      showToast(zh.me.saved);
    } catch (error: unknown) {
      console.warn('设置保存失败', error);
      showToast(zh.me.loadError);
    }
  }

  async function toggleDeck(id: string, value: boolean) {
    const previous = enabled;
    const next = new Set(enabled);
    if (value) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setEnabled(next);
    try {
      await setSetting('enabled_decks', JSON.stringify([...next]));
    } catch (error: unknown) {
      console.warn('学科设置保存失败', error);
      setEnabled(previous);
      showToast(zh.me.loadError);
    }
  }

  async function doReset() {
    try {
      await resetProgress();
      setResetOpen(false);
      await load();
      showToast(zh.me.resetDone);
    } catch (error: unknown) {
      console.warn('重置进度失败', error);
      showToast(zh.me.loadError);
    }
  }

  async function shiftDue() {
    try {
      await advanceAllDueByOneDay();
      showToast(zh.me.shiftDone);
    } catch (error: unknown) {
      console.warn('开发时间拨动失败', error);
      showToast(zh.me.loadError);
    }
  }

  async function toggleReminder(value: boolean) {
    if (!value) {
      try {
        await disableDailyReminder();
        await setSetting('reminder_enabled', 'false');
        setReminderEnabled(false);
      } catch (error: unknown) {
        console.warn('关闭提醒失败', error);
        showToast(zh.me.loadError);
      }
      return;
    }
    try {
      const allowed = await enableDailyReminder();
      if (!allowed) {
        setPermissionOpen(true);
        setReminderEnabled(false);
        return;
      }
      await setSetting('reminder_enabled', 'true');
      setReminderEnabled(true);
    } catch (error: unknown) {
      console.warn('开启提醒失败', error);
      setReminderEnabled(false);
      showToast(zh.me.loadError);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{zh.me.title}</Text>
        <Text style={styles.description}>{zh.me.description}</Text>
        {failed ? <Text style={styles.error}>{zh.me.loadError}</Text> : null}

        <MeLearningSettings
          decks={decks}
          enabled={enabled}
          newLimit={newLimit}
          onDeck={(id, value) => void toggleDeck(id, value)}
          onLimit={(key) =>
            setSelector({
              key,
              title:
                key === 'daily_new_limit' ? zh.me.dailyNew : zh.me.dailyReview,
              options:
                key === 'daily_new_limit'
                  ? [10, 15, 20, 30, 50]
                  : [40, 80, 120, 200],
              value: key === 'daily_new_limit' ? newLimit : reviewLimit,
            })
          }
          onReminder={(value) => void toggleReminder(value)}
          reminderEnabled={reminderEnabled}
          reminderTime={reminderTime}
          reviewLimit={reviewLimit}
        />
        <MeDataSettings
          cards={summary.cards}
          decks={summary.decks}
          onAISettings={() => router.push('/ai-settings')}
          onClearAI={() => {
            void clearAICache()
              .then(() => showToast(zh.me.cacheCleared))
              .catch((error: unknown) => {
                console.warn('AI 缓存清理失败', error);
                showToast(zh.me.loadError);
              });
          }}
          onRegenerate={() => router.push('/study')}
          onReset={() => setResetOpen(true)}
          onShiftDue={() => void shiftDue()}
        />
      </ScrollView>
      <OptionSheet
        onClose={() => setSelector(null)}
        onSelect={(value) => {
          if (selector) {
            void saveLimit(selector.key, value);
          }
        }}
        options={selector?.options ?? []}
        selected={selector?.value ?? 0}
        title={selector?.title ?? ''}
        visible={selector !== null}
      />
      <ConfirmSheet
        confirmLabel={zh.me.resetConfirm}
        message={zh.me.resetMessage}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void doReset()}
        title={zh.me.resetTitle}
        visible={resetOpen}
      />
      <ConfirmSheet
        confirmLabel={zh.reminder.openSettings}
        message={zh.reminder.permissionBody}
        onClose={() => setPermissionOpen(false)}
        onConfirm={() => {
          setPermissionOpen(false);
          void Linking.openSettings();
        }}
        title={zh.reminder.permissionTitle}
        visible={permissionOpen}
      />
    </Screen>
  );
}
