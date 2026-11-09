import type { City, Source } from './cities';
import type { Window } from './windows';
import type { Score } from './scoring';
import type { Weights } from './credibility';
import type { blend } from './blend';
import type { Memory, recallRecords } from './memory';
import type { ChainSnapshot } from './tatum';
export type CitySnapshot = { city: City; fetchedAt: string; provenance: { observed: string; historical: string; forward: string; forecastLabel: string }; windows: { window: Window; observed: number; forecasts: Partial<Record<Source, number>> }[]; upcoming: { window: Window; forecasts: Partial<Record<Source, number>> }; scores: Score[]; weights: Weights; credibilityMode: 'computed-local' | 'recalled'; probabilities: ReturnType<typeof blend>; explanations: string[]; trainingHash: string; warnings: string[] };
export type Snapshot = { generatedAt: string; mode: 'dry-run' | 'live'; cities: CitySnapshot[]; errors: { city: string; message: string }[]; memories: { mode: 'dry-run' | 'live'; written: Memory[]; results: { id: string; status: string }[]; recalled: Awaited<ReturnType<typeof recallRecords>>[] }; chain: ChainSnapshot };
