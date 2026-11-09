import { thresholds, type Source } from './cities';
export type Sample = { window: string; observed: number; forecast: number };
export type Score = { source: Source; mae: number; n: number; hitRate: number; wins: number; residuals: number[] };
export function scoreWindow(forecast: number, observed: number) { return { absoluteError: Math.abs(forecast - observed), hits: thresholds.map(t => (forecast >= t) === (observed >= t)) }; }
export function scoreSources(samples: Partial<Record<Source, Sample[]>>): Score[] {
  return Object.entries(samples).filter(([, rows]) => rows.length).map(([key, rows]) => {
    const source = key as Source; const n = rows.length;
    return { source, n, mae: rows.reduce((sum, r) => sum + scoreWindow(r.forecast, r.observed).absoluteError, 0) / n, hitRate: rows.reduce((sum, r) => sum + scoreWindow(r.forecast, r.observed).hits.filter(Boolean).length, 0) / (n * thresholds.length), wins: rows.filter(r => Object.values(samples).every(others => { const other = others.find(o => o.window === r.window); return !other || Math.abs(r.forecast - r.observed) <= Math.abs(other.forecast - other.observed); })).length, residuals: rows.map(r => r.observed - r.forecast) };
  });
}
