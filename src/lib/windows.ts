/** Inclusive local calendar-date interval; backfill marks historical evidence, upcoming marks a forward window. */
export type Window = { id: string; start: string; end: string; kind: 'backfill' | 'upcoming' };
/** Add calendar days to an ISO date without local daylight-saving time arithmetic. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** Return the ISO calendar date for an instant in the supplied IANA timezone. */
export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
/** List inclusive ISO calendar dates between the start and end dates. */
export function dates(start: string, end: string): string[] {
  const result: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) result.push(d);
  return result;
}
/** Return the ISO week identifier for a calendar date, including ISO year boundaries. */
export function weekId(start: string): string {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4, 12));
  return `${year}-W${String(1 + Math.round((d.getTime() - first.getTime()) / 86400000 / 7)).padStart(2, '0')}`;
}
/** Return complete Monday–Sunday backfill intervals preceding today; count is a number of weeks. */
export function backfillWindows(today: string, count = 10): Window[] {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDays(today, -(weekday + 6) % 7);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(monday, -7 * (count - i));
    return { id: weekId(start), start, end: addDays(start, 6), kind: 'backfill' };
  });
}
/** Return a seven-calendar-day forward interval beginning today. */
export function upcomingWindow(today: string): Window {
  return { id: `next:${today}`, start: today, end: addDays(today, 6), kind: 'upcoming' };
}
/** Sum daily rainfall in mm; return null unless every date has a finite observation. */
export function totalForWindow(
  values: Record<string, number | null>,
  window: Window,
): number | null {
  const numbers = dates(window.start, window.end).map((d) => values[d]);
  return numbers.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? (numbers as number[]).reduce((a, b) => a + b, 0)
    : null;
}
