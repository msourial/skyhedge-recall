import { thresholds, type Source } from './cities';
/** One backfill forecast/observation pair; both rainfall amounts are mm. */
export type Sample = { window: string; observed: number; forecast: number };
/** Source accuracy: MAE/residuals in mm, hitRate in 0..1; wins use only comparisonWeeks shared by every supplied source. */
export type Score = {
  source: Source;
  mae: number;
  n: number;
  hitRate: number;
  wins: number;
  residuals: number[];
  comparisonMae: number | null;
  comparisonWeeks: string[];
};
/** Compare rainfall forecast and observation in mm; threshold equality counts as a hit. */
export function scoreWindow(forecast: number, observed: number) {
  return {
    absoluteError: Math.abs(forecast - observed),
    hits: thresholds.map((threshold) => forecast >= threshold === observed >= threshold),
  };
}
function meanError(rows: Sample[]): number {
  return rows.reduce((sum, row) => sum + Math.abs(row.forecast - row.observed), 0) / rows.length;
}
function commonWeeks(groups: Sample[][]): string[] {
  if (groups.length < 2) return [];
  return (groups[0] ?? [])
    .filter((row) => groups.every((group) => group.some((other) => other.window === row.window)))
    .map((row) => row.window)
    .sort();
}
function isClosest(row: Sample, groups: Sample[][]): boolean {
  return groups.every((group) => {
    const other = group.find((other) => other.window === row.window);
    return (
      other !== undefined &&
      Math.abs(row.forecast - row.observed) <= Math.abs(other.forecast - other.observed)
    );
  });
}
/** Compute source-specific errors/residuals plus comparative MAE and wins on common complete weeks; no solo wins. */
export function scoreSources(samples: Partial<Record<Source, Sample[]>>): Score[] {
  const groups = Object.values(samples);
  const comparisonWeeks = commonWeeks(groups);
  return Object.entries(samples)
    .filter(([, rows]) => rows.length > 0)
    .map(([key, rows]) => {
      const comparable = rows.filter((row) => comparisonWeeks.includes(row.window));
      return {
        source: key as Source,
        n: rows.length,
        mae: meanError(rows),
        hitRate:
          rows.reduce(
            (sum, row) => sum + scoreWindow(row.forecast, row.observed).hits.filter(Boolean).length,
            0,
          ) /
          (rows.length * thresholds.length),
        wins: comparable.filter((row) => isClosest(row, groups)).length,
        residuals: rows.map((row) => row.observed - row.forecast),
        comparisonMae: comparable.length ? meanError(comparable) : null,
        comparisonWeeks,
      };
    });
}
