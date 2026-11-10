import { create } from 'zustand';
import { getSetting, initDatabase } from '@/db/repository';

type SettingsState = {
  ready: boolean;
  onboarded: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ready: false,
  onboarded: false,
  error: null,
  initialize: async () => {
    try {
      await initDatabase();
      const onboarded = (await getSetting('onboarded')) === 'true';
      set({ ready: true, onboarded, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '数据库初始化失败';
      set({ ready: false, error: message });
    }
  },
  setOnboarded: (onboarded) => set({ onboarded }),
}));
