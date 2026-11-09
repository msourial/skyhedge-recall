import { describe, expect, it } from 'vitest';
import { addDays, backfillWindows, dates, localDate, totalForWindow, upcomingWindow, weekId } from './windows';
import { scoreSources, scoreWindow } from './scoring';
import { credibility } from './credibility';
import { blend, probability } from './blend';
import { explain } from './explain';
import { parseNoaa } from './noaa';
const samples = { gfs_seamless: [{ window: 'a', forecast: 20, observed: 25 }, { window: 'b', forecast: 5, observed: 5 }], ecmwf_ifs025: [{ window: 'a', forecast: 30, observed: 25 }, { window: 'b', forecast: 15, observed: 5 }] };
const scores = scoreSources(samples);
describe('local calendar windows', () => {
  it('keeps Monday through Sunday before the run date', () => {
    const weeks = backfillWindows('2026-11-09', 2);
    expect(weeks.map(w => [w.start, w.end])).toEqual([['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08']]);
    expect(backfillWindows('2026-11-08', 1)[0].start).toBe('2026-10-26');
  });
  it('handles ISO year boundaries, leap dates, DST, and local midnight', () => {
    expect(weekId('2025-12-29')).toBe('2026-W01');
    expect(weekId('2021-01-01')).toBe('2020-W53');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(localDate(new Date('2026-11-02T02:00:00Z'), 'America/New_York')).toBe('2026-11-01');
    expect(dates('2026-11-01', '2026-11-07')).toHaveLength(7);
    expect(upcomingWindow('2026-12-29').end).toBe('2027-01-04');
  });
  it('rejects a week with any missing or null day, preserves zero rain', () => {
    const window = upcomingWindow('2026-11-01'); const values = Object.fromEntries(dates(window.start, window.end).map(d => [d, 0]));
    expect(totalForWindow(values, window)).toBe(0);
    delete values[window.start]; expect(totalForWindow(values, window)).toBeNull();
    expect(totalForWindow({ ...values, [window.start]: null }, window)).toBeNull();
  });
});
describe('scoring and credibility', () => {
  it('includes threshold equality and counts tied wins', () => {
    expect(scoreWindow(25, 25)).toEqual({ absoluteError: 0, hits: [true, true, true] });
    expect(scores[0]).toMatchObject({ mae: 2.5, n: 2, wins: 2, residuals: [5, 0], hitRate: 5 / 6 });
    expect(scores[1]).toMatchObject({ mae: 7.5, wins: 1 });
  });
  it('normalizes inverse MAE, falls back to uniform without history', () => {
    const weights = credibility(scores, ['gfs_seamless', 'ecmwf_ifs025']);
    expect(weights.gfs_seamless).toBeCloseTo(8.5 / 12);
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(credibility([], ['gfs_seamless', 'ecmwf_ifs025'])).toEqual({ gfs_seamless: 0.5, ecmwf_ifs025: 0.5 });
    expect(credibility([], [])).toEqual({});
  });
});
describe('empirical blend and explanations', () => {
  it('uses residuals with Laplace smoothing including no history', () => {
    expect(probability(20, 25, [5, 0])).toBe(0.5);
    expect(probability(100, 25, [])).toBe(0.5);
    expect(probability(20, 25, [5, 10])).toBe(0.75);
  });
  it('computes weighted vs naive and renormalizes available sources', () => {
    const rows = blend({ gfs_seamless: 20, ecmwf_ifs025: 20 }, scores, { gfs_seamless: 0.8, ecmwf_ifs025: 0.2 });
    expect(rows[1]).toMatchObject({ naive: 0.375, weighted: 0.45 });
    expect(rows[1].delta).toBeCloseTo(0.075);
    expect(blend({}, [], {})[0].weighted).toBeNull();
    expect(blend({ gfs_seamless: 20 }, scores, { gfs_seamless: 0.8 })[1].weighted).toBe(0.5);
  });
  it('explains actual sample counts and weights', () => {
    expect(explain('Example', scores, { gfs_seamless: 0.8 })[0]).toBe('Trusting GFS (NOAA) 80.0% in Example: it tied or beat available sources in 2 of 2 backfill weeks (MAE 2.50 mm).');
  });
});
it('parses NOAA metric numbers without interpreting missing values as zero', () => {
  expect(parseNoaa([{ DATE: '2026-01-01', PRCP: '0' }, { DATE: '2026-01-02', PRCP: '' }, { DATE: '2026-01-03', PRCP: '-9999' }, { DATE: '2026-01-04', PRCP: null }, { DATE: '2026-01-05', PRCP: '9.9' }])).toEqual({ '2026-01-01': 0, '2026-01-05': 9.9 });
});
