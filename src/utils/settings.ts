export function parseEnabledDecks(value: string | null): Set<string> {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter((item): item is string => typeof item === 'string'),
      );
    }
  } catch {
    // 无效设置回落到默认全选。
  }
  return new Set(['ds', 'co', 'os', 'cn', 'ai', 'agent']);
}
