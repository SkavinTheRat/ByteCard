import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  configureNotificationHandler,
  refreshDailyReminderIfEnabled,
} from '@/notifications/reminder';
import { useSettingsStore } from '@/store/settingsStore';

export function useReminderSync(): void {
  const ready = useSettingsStore((state) => state.ready);
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void refreshDailyReminderIfEnabled().catch((error: unknown) => {
      console.warn('提醒刷新失败', error);
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshDailyReminderIfEnabled().catch((error: unknown) => {
          console.warn('前台提醒刷新失败', error);
        });
      }
    });
    return () => subscription.remove();
  }, [ready]);
}
