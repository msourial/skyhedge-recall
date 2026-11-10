import { blend } from '../blend';
import { sources } from '../cities';
import { credibility } from '../credibility';
import { scoreSources } from '../scoring';
import type { CitySnapshot } from '../snapshot';
/** A held-out backfill prediction: probabilities and Brier losses in 0..1, weights unitless. */
export type LearningWeek = {
  week: string;
  trainingWeeks: string[];
  weights: ReturnType<typeof credibility>;
  memoryOn: number;
  memoryOff: number;
  observed: boolean;
  brierOn: number;
  brierOff: number;
};
/** Score week k using only weeks before k; first prediction is the third complete week. */
export function walkForward(windows: CitySnapshot['windows']): LearningWeek[] {
  return windows.slice(2).flatMap((row, offset) => {
    const history = windows.slice(0, offset + 2);
    const samples = Object.fromEntries(
      sources.map((source) => [
        source,
        history.flatMap((prior) =>
          prior.forecasts[source] === undefined
            ? []
            : [
                {
                  window: prior.window.id,
                  observed: prior.observed,
                  forecast: prior.forecasts[source]!,
                },
              ],
        ),
      ]),
    );
    const scores = scoreSources(samples);
    const available = sources.filter((source) => row.forecasts[source] !== undefined);
    const weights = credibility(scores, available);
    const prediction = blend(row.forecasts, scores, weights).find((rung) => rung.threshold === 25)!;
    if (prediction.weighted === null || prediction.naive === null) return [];
    const observed = row.observed >= 25;
    return [
      {
        week: row.window.id,
        trainingWeeks: history.map((prior) => prior.window.id),
        weights,
        memoryOn: prediction.weighted,
        memoryOff: prediction.naive,
        observed,
        brierOn: (prediction.weighted - Number(observed)) ** 2,
        brierOff: (prediction.naive - Number(observed)) ** 2,
      },
    ];
  });
}
