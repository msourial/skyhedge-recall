import { type Source } from './cities';
import type { Score } from './scoring';
export type Weights = Partial<Record<Source, number>>;
// Normalized inverse MAE: w_s = (MAE_s + 1 mm)^-1 / sum_s (MAE_s + 1 mm)^-1.
export function credibility(scores: Score[], available: readonly Source[]): Weights {
  const raw = available.map(source => { const score = scores.find(s => s.source === source); return [source, score ? 1 / (score.mae + 1) : 1] as const; });
  const total = raw.reduce((sum, [, w]) => sum + w, 0); return Object.fromEntries(raw.map(([s, w]) => [s, w / total]));
}
