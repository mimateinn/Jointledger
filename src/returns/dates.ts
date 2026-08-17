/** Calendar dates as YYYY-MM-DD. Arithmetic is UTC date-only so HK calendar days stay stable. */

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("日期格式不正確");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return toIsoDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

export function eachDay(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }
  const out: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

export function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}
