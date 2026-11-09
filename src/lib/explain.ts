import { sourceNames } from './cities';
import type { Weights } from './credibility';
import type { Score } from './scoring';
export function explain(city: string, scores: Score[], weights: Weights): string[] {
  return scores.map(s => `Trusting ${sourceNames[s.source]} ${((weights[s.source] ?? 0) * 100).toFixed(1)}% in ${city}: it tied or beat available sources in ${s.wins} of ${s.n} backfill weeks (MAE ${s.mae.toFixed(2)} mm).`);
}
