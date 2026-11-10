import { thresholds, type Source } from './cities';
import type { Weights } from './credibility';
import type { Score } from './scoring';
/** Estimate P(observed ≥ threshold), in 0..1, from forecast, threshold and residuals in mm with Laplace smoothing. */
export function probability(forecast: number, threshold: number, residuals: number[]): number {
  return (residuals.filter((r) => forecast + r >= threshold).length + 1) / (residuals.length + 2);
}
/** Blend empirical probabilities (0..1); forecasts and thresholds are mm, delta is a probability fraction. */
export function blend(
  forecasts: Partial<Record<Source, number>>,
  scores: Score[],
  weights: Weights,
) {
  const entries = Object.entries(forecasts) as [Source, number][];
  const weightSum = entries.reduce((sum, [s]) => sum + (weights[s] ?? 0), 0);
  return thresholds.map((threshold) => {
    const perSource = Object.fromEntries(
      entries.map(([s, f]) => [
        s,
        probability(f, threshold, scores.find((score) => score.source === s)?.residuals ?? []),
      ]),
    );
    const naive = entries.length
      ? entries.reduce((sum, [s]) => sum + perSource[s], 0) / entries.length
      : null;
    const weighted = weightSum
      ? entries.reduce((sum, [s]) => sum + perSource[s] * (weights[s] ?? 0), 0) / weightSum
      : naive;
    return {
      threshold,
      perSource,
      naive,
      weighted,
      delta: weighted === null || naive === null ? null : weighted - naive,
    };
  });
}
