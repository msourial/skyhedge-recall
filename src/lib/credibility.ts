import { type Source } from './cities';
import type { Score } from './scoring';
/** Normalized source credibility, each weight a fraction in 0..1. */
export type Weights = Partial<Record<Source, number>>;
/** Softmax temperature in mm: a 2 mm MAE disadvantage multiplies weight by exp(-1). */
export const CREDIBILITY_TAU_MM = 2;
/** Compute exp(-(MAE - minimum MAE)/tau), normalized; uniform without shared history. */
export function credibility(scores: Score[], available: readonly Source[]): Weights {
  const matching = available.map((source) => scores.find((score) => score.source === source));
  const hasHistory = matching.every(
    (score) =>
      score &&
      score.comparisonMae !== null &&
      score.comparisonWeeks.length > 0 &&
      JSON.stringify(score.comparisonWeeks) === JSON.stringify(matching[0]?.comparisonWeeks),
  );
  const minimum = Math.min(...matching.map((score) => score?.comparisonMae ?? 0));
  const raw = available.map(
    (source, index) =>
      [
        source,
        hasHistory
          ? Math.exp(-(matching[index]!.comparisonMae! - minimum) / CREDIBILITY_TAU_MM)
          : 1,
      ] as const,
  );
  const total = raw.reduce((sum, [, weight]) => sum + weight, 0);
  return Object.fromEntries(raw.map(([source, weight]) => [source, weight / total]));
}
