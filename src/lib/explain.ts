import { sourceNames } from './cities';
import type { Weights } from './credibility';
import type { Score } from './scoring';
/** Explain source weights (0..1) and absolute rainfall errors in mm, highest weight first. */
export function explain(city: string, scores: Score[], weights: Weights): string[] {
  return [...scores]
    .sort((a, b) => (weights[b.source] ?? 0) - (weights[a.source] ?? 0))
    .map((score) => {
      const otherErrors = scores
        .filter((other) => other.source !== score.source)
        .map((other) => other.comparisonMae ?? other.mae);
      const comparison = otherErrors.length
        ? ` vs ${Math.min(...otherErrors).toFixed(1)}–${Math.max(...otherErrors).toFixed(1)} mm for the others`
        : '';
      if (!score.comparisonWeeks.length)
        return `Trusting ${sourceNames[score.source]} ${Math.round((weights[score.source] ?? 0) * 100)}% in ${city}: uniform trust without shared backfill history; source-specific MAE ${score.mae.toFixed(1)} mm.`;
      return `Trusting ${sourceNames[score.source]} ${Math.round((weights[score.source] ?? 0) * 100)}% in ${city}: it was closest (including ties) in ${score.wins} of the last ${score.comparisonWeeks.length} backfill weeks (MAE ${(score.comparisonMae ?? score.mae).toFixed(1)} mm${comparison}).`;
    });
}
