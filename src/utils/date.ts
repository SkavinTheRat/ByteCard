export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatChineseDate(date = new Date()): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
