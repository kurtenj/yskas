export const LOGGING_TIMEZONE = "America/Chicago";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOGGING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function formatDateKey(d: Date): string {
  const parts = dateFormatter.formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function todayDate(): string {
  return formatDateKey(new Date());
}

export function validateDateKey(date: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid logging date.");
  return date;
}
export function offsetDate(date: string, days: number): string {
  validateDateKey(date);
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function getLast7Days(date = todayDate()): string[] {
  return Array.from({ length: 7 }, (_, i) => offsetDate(date, -i));
}
export function captureLoggingTime(now = Date.now()) {
  return { loggedAt: now, date: formatDateKey(new Date(now)) };
}
/** Find the next Chicago date boundary, including 23/25-hour DST days. */
export function nextLoggingMidnight(now = Date.now()): number {
  const date = formatDateKey(new Date(now));
  let low = now,
    high = now + 26 * 60 * 60 * 1000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (formatDateKey(new Date(mid)) === date) low = mid;
    else high = mid;
  }
  return high;
}
