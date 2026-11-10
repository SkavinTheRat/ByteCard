import { create } from 'zustand';

type ToastState = {
  message: string;
  visible: boolean;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  visible: false,
  hide: () => set({ visible: false }),
}));

export function showToast(message: string): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  useToastStore.setState({ message, visible: true });
  hideTimer = setTimeout(() => {
    useToastStore.getState().hide();
  }, 2000);
}
