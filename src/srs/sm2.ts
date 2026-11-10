export type SM2State = {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

export type SM2Result = SM2State & {
  status: 'learning' | 'review' | 'lapsed';
  nextDueAt: Date;
};

export function schedule(
  state: SM2State,
  quality: number,
  now: Date = new Date(),
): SM2Result {
  const q = Math.min(5, Math.max(0, Math.round(quality)));
  const ease = Math.max(
    1.3,
    state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  if (q < 3) {
    const intervalDays = 1;
    return {
      ease,
      intervalDays,
      reps: 0,
      lapses: state.lapses + 1,
      status: 'lapsed',
      nextDueAt: new Date(now.getTime() + intervalDays * 86_400_000),
    };
  }

  let intervalDays: number;
  if (state.reps === 0) {
    intervalDays = 1;
  } else if (state.reps === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(state.intervalDays * ease);
  }

  return {
    ease,
    intervalDays,
    reps: state.reps + 1,
    lapses: state.lapses,
    status: state.reps === 0 ? 'learning' : 'review',
    nextDueAt: new Date(now.getTime() + intervalDays * 86_400_000),
  };
}

export function describeInterval(days: number): string {
  if (days <= 0) {
    return '今天';
  }
  if (days === 1) {
    return '明天';
  }
  if (days < 30) {
    return `${days} 天后`;
  }
  return `${Math.max(1, Math.round(days / 30))} 个月后`;
}
