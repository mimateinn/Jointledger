/** US regular session — pack TTL is 15 minutes while this is true, else 60. */
export function isUsEquityRegularHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function packTtlMs(now = new Date()): number {
  return isUsEquityRegularHours(now) ? 15 * 60 * 1000 : 60 * 60 * 1000;
}

export function nextUtcMinute(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(next.getUTCMinutes() + 1);
  return next;
}

export function utcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
