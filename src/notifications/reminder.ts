import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getQueueCounts, getSetting } from '@/db/repository';
import { zh } from '@/i18n/zh';

const CHANNEL_ID = 'bytecard-daily';

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: zh.reminder.channelName,
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120],
    enableVibrate: true,
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour ?? 20);
  const minute = Number(rawMinute ?? 30);
  return {
    hour: Math.max(0, Math.min(23, Number.isFinite(hour) ? hour : 20)),
    minute: Math.max(0, Math.min(59, Number.isFinite(minute) ? minute : 30)),
  };
}

export async function scheduleDailyReminder(time?: string): Promise<void> {
  const savedTime = time ?? (await getSetting('reminder_time')) ?? '20:30';
  const { hour, minute } = parseTime(savedTime);
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    return;
  }
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const queue = await getQueueCounts();
  const body =
    queue.total > 0
      ? zh.reminder.body(queue.total)
      : zh.reminder.bodyEmpty;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: zh.reminder.title,
      body,
      data: { screen: 'study' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function enableDailyReminder(): Promise<boolean> {
  const allowed = await requestReminderPermission();
  if (!allowed) {
    return false;
  }
  await scheduleDailyReminder();
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function refreshDailyReminderIfEnabled(): Promise<void> {
  const enabled = (await getSetting('reminder_enabled')) === 'true';
  if (enabled) {
    await scheduleDailyReminder();
  }
}
