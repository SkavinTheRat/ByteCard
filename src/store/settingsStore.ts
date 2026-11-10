import { create } from 'zustand';
import { initDatabase } from '@/db/repository';

type SettingsState = {
  ready: boolean;
  error: string | null;
  initialize: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ready: false,
  error: null,
  initialize: async () => {
    try {
      await initDatabase();
      set({ ready: true, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '数据库初始化失败';
      set({ ready: false, error: message });
    }
  },
}));
