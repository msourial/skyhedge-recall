export type Window = { id: string; start: string; end: string; kind: 'backfill' | 'upcoming' };
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function dates(start: string, end: string): string[] {
  const result: string[] = []; for (let d = start; d <= end; d = addDays(d, 1)) result.push(d); return result;
}
export function weekId(start: string): string {
  const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
  const year = d.getUTCFullYear(); const first = new Date(Date.UTC(year, 0, 4, 12));
  return `${year}-W${String(1 + Math.round((d.getTime() - first.getTime()) / 86400000 / 7)).padStart(2, '0')}`;
}
export function backfillWindows(today: string, count = 10): Window[] {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); const monday = addDays(today, -(weekday + 6) % 7);
  return Array.from({ length: count }, (_, i) => { const start = addDays(monday, -7 * (count - i)); return { id: weekId(start), start, end: addDays(start, 6), kind: 'backfill' }; });
}
export function upcomingWindow(today: string): Window { return { id: `next:${today}`, start: today, end: addDays(today, 6), kind: 'upcoming' }; }
export function totalForWindow(values: Record<string, number | null>, window: Window): number | null {
  const numbers = dates(window.start, window.end).map(d => values[d]);
  return numbers.every(n => typeof n === 'number' && Number.isFinite(n)) ? (numbers as number[]).reduce((a, b) => a + b, 0) : null;
}
