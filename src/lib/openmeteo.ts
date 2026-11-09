import { sources, type City, type Source } from './cities';
import { fetchJson } from './retry';
type Response = { daily?: { time: string[]; [key: string]: (string | number | null)[] } };
export async function fetchForecast(city: City, start: string, end: string, historical: boolean) {
  const params = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), start_date: start, end_date: end, daily: 'precipitation_sum', timezone: city.timezone, models: sources.join(',') });
  const url = `https://${historical ? 'historical-forecast-api' : 'api'}.open-meteo.com/v1/forecast?${params}`;
  const body = await fetchJson<Response>(url);
  if (!body.daily?.time) throw new Error('Open-Meteo response has no daily dates');
  const daily = body.daily;
  const values = Object.fromEntries(sources.map(source => [source, Object.fromEntries(daily.time.map((d, i) => { const n = daily[`precipitation_sum_${source}`]?.[i]; return [d, typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null]; }))])) as Record<Source, Record<string, number | null>>;
  return { url, values };
}
