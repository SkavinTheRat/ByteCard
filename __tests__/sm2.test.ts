/// <reference types="jest" />

import { describeInterval, schedule, type SM2State } from '@/srs/sm2';

const fresh: SM2State = {
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
};

describe('SM-2', () => {
  it('首次 q=5 的间隔为 1 天', () => {
    const result = schedule(fresh, 5, new Date('2026-01-01T00:00:00Z'));
    expect(result.intervalDays).toBe(1);
    expect(result.status).toBe('learning');
    expect(result.ease).toBeCloseTo(2.6);
  });

  it('第二次 q=5 的间隔为 6 天', () => {
    const first = schedule(fresh, 5);
    const result = schedule(first, 5);
    expect(result.intervalDays).toBe(6);
    expect(result.reps).toBe(2);
    expect(result.status).toBe('review');
  });

  it('第三次从 6 天状态使用更新后的 EF 计算', () => {
    const result = schedule(
      { ease: 2.7, intervalDays: 6, reps: 2, lapses: 0 },
      5,
    );
    expect(result.ease).toBeCloseTo(2.8);
    expect(result.intervalDays).toBe(17);
  });

  it('题面指定状态 q=5 时得到 round(6×2.6)=16', () => {
    const result = schedule(
      { ease: 2.5, intervalDays: 6, reps: 2, lapses: 0 },
      5,
    );
    expect(result.intervalDays).toBe(16);
  });

  it('答错 q=0 时 interval=1、reps 归零且 lapses 加一', () => {
    const result = schedule(
      { ease: 2.5, intervalDays: 20, reps: 4, lapses: 2 },
      0,
    );
    expect(result.intervalDays).toBe(1);
    expect(result.reps).toBe(0);
    expect(result.lapses).toBe(3);
    expect(result.status).toBe('lapsed');
  });

  it('q=3 时 EF 下降', () => {
    expect(schedule(fresh, 3).ease).toBeLessThan(fresh.ease);
  });

  it('EF 永不低于 1.3', () => {
    expect(schedule({ ...fresh, ease: 1.3 }, 0).ease).toBe(1.3);
  });
});

describe('describeInterval', () => {
  it.each([
    [0, '今天'],
    [1, '明天'],
    [12, '12 天后'],
    [60, '2 个月后'],
  ])('%i 天显示为 %s', (days, text) => {
    expect(describeInterval(days)).toBe(text);
  });
});
