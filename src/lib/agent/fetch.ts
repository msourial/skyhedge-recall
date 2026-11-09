import { blend } from '../blend';
import { cities, sources, type Source } from '../cities';
import { credibility, CREDIBILITY_TAU_MM } from '../credibility';
import { explain } from '../explain';
import { textHash } from '../memory';
import { fetchNoaa } from '../noaa';
import { fetchForecast } from '../openmeteo';
import { scoreSources, type Sample } from '../scoring';
import type { CitySnapshot } from '../snapshot';
import { addDays, backfillWindows, localDate, totalForWindow, upcomingWindow } from '../windows';
import { walkForward } from './score';

/** Fetch real daily precipitation in mm and score complete backfill weeks. */
export async function fetchCity(city: (typeof cities)[number], now: Date): Promise<CitySnapshot> {
  const today = localDate(now, city.timezone);
  const candidates = backfillWindows(today, 14);
  const upcoming = upcomingWindow(today);
  const observed = await fetchNoaa(city, candidates[0].start, addDays(today, -1));
  if (!Object.keys(observed.values).length)
    throw new Error('NOAA station returned no usable precipitation data');
  const historical = await fetchForecast(city, candidates[0].start, addDays(today, -1), true);
  const forward = await fetchForecast(city, upcoming.start, upcoming.end, false);
  const windows = candidates
    .flatMap((window) => {
      const total = totalForWindow(observed.values, window);
      if (total === null) return [];
      const forecasts = Object.fromEntries(
        sources.flatMap((source) => {
          const n = totalForWindow(historical.values[source], window);
          return n === null ? [] : [[source, n]];
        }),
      ) as Partial<Record<Source, number>>;
      return [{ window, observed: total, forecasts }];
    })
    .slice(-10);
  if (!windows.length) throw new Error('No complete NOAA backfill weeks in requested range');
  const samples = Object.fromEntries(
    sources.map((source) => [
      source,
      windows.flatMap((w) =>
        w.forecasts[source] === undefined
          ? []
          : [{ window: w.window.id, observed: w.observed, forecast: w.forecasts[source]! }],
      ),
    ]),
  ) as Record<Source, Sample[]>;
  const scores = scoreSources(samples);
  const forecasts = Object.fromEntries(
    sources.flatMap((source) => {
      const n = totalForWindow(forward.values[source], upcoming);
      return n === null ? [] : [[source, n]];
    }),
  ) as Partial<Record<Source, number>>;
  const available = sources.filter((s) => forecasts[s] !== undefined);
  if (!available.length) throw new Error('No complete forward forecast for upcoming dates');
  const weights = credibility(scores, available);
  const entry: CitySnapshot = {
    learning: walkForward(windows),
    city,
    fetchedAt: new Date().toISOString(),
    provenance: {
      observed: observed.url,
      historical: historical.url,
      forward: forward.url,
      forecastLabel:
        'Model forecasts via Open-Meteo historical forecast; historical windows are backfill',
    },
    windows,
    upcoming: { window: upcoming, forecasts },
    scores,
    weights,
    credibilityMode: 'computed-local',
    probabilities: blend(forecasts, scores, weights),
    explanations: explain(city.name, scores, weights),
    trainingHash: textHash(
      JSON.stringify({
        samples,
        credibility: {
          formula: 'exponential-mae',
          tauMm: CREDIBILITY_TAU_MM,
          comparison: 'common-complete-weeks-v1',
        },
      }),
    ),
    warnings: sources
      .filter((s) => !available.includes(s))
      .map((s) => `${s}: incomplete forward forecast; excluded`),
  };

  return entry;
}
