import { useEffect, useState } from 'react';
import { checkRemoteDeckUpdate, type UpdateResult } from '@/db/remoteUpdate';
import { useSessionStore } from '@/store/sessionStore';

export function useRemoteDeckUpdate(enabled: boolean): {
  result: UpdateResult | null;
  dismiss: () => void;
} {
  const [result, setResult] = useState<UpdateResult | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      const state = useSessionStore.getState();
      if (state.active) return;
      void checkRemoteDeckUpdate({
        beforeApply: () => {
          const latest = useSessionStore.getState();
          return !latest.active;
        },
      })
        .then((update) => {
          if (update.status === 'updated') setResult(update);
        })
        .catch((error: unknown) => {
          console.warn('后台题库更新失败', error);
        });
    }, 3_000);
    return () => clearTimeout(timer);
  }, [enabled]);

  return { result, dismiss: () => setResult(null) };
}
