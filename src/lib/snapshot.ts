import type { LearningWeek } from './agent/score';
import type { blend } from './blend';
import type { City, Source } from './cities';
import type { Weights } from './credibility';
import type { Memory, recallRecords } from './memory';
import type { Score } from './scoring';
import type { ChainSnapshot } from './tatum';
import type { Window } from './windows';
/** Captured city evidence: precipitation and MAE in mm, weights/probabilities in 0..1, timestamps in ISO format. */
export type CitySnapshot = {
  learning: LearningWeek[];
  city: City;
  fetchedAt: string;
  provenance: { observed: string; historical: string; forward: string; forecastLabel: string };
  windows: { window: Window; observed: number; forecasts: Partial<Record<Source, number>> }[];
  upcoming: { window: Window; forecasts: Partial<Record<Source, number>> };
  scores: Score[];
  weights: Weights;
  credibilityMode: 'computed-local' | 'recalled';
  probabilities: ReturnType<typeof blend>;
  explanations: string[];
  trainingHash: string;
  warnings: string[];
};
/** Public agent snapshot with city evidence, memory provenance and raw chain reads; no credentials. */
export type Snapshot = {
  generatedAt: string;
  mode: 'dry-run' | 'live';
  cities: CitySnapshot[];
  errors: { city: string; message: string }[];
  memories: {
    mode: 'dry-run' | 'live';
    written: Memory[];
    results: { id: string; status: string }[];
    recalled: Awaited<ReturnType<typeof recallRecords>>[];
  };
  chain: ChainSnapshot;
};
