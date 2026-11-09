import type { City } from './cities';
import { fetchJson } from './retry';
export function parseNoaa(rows: { DATE: string; PRCP?: string | number | null }[]): Record<string, number> {
  return Object.fromEntries(rows.filter(r => r.PRCP !== undefined && r.PRCP !== null && String(r.PRCP).trim() !== '' && Number.isFinite(Number(r.PRCP)) && Number(r.PRCP) >= 0).map(r => [r.DATE.slice(0, 10), Number(r.PRCP)]));
}
export async function fetchNoaa(city: City, start: string, end: string) {
  const params = new URLSearchParams({ dataset: 'daily-summaries', stations: city.station, startDate: start, endDate: end, dataTypes: 'PRCP', units: 'metric', format: 'json' });
  const url = `https://www.ncei.noaa.gov/access/services/data/v1?${params}`;
  return { url, values: parseNoaa(await fetchJson<{ DATE: string; PRCP?: string }[]>(url)) };
}
