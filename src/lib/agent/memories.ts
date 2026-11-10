import { sourceNames, sources, type Source } from '../cities';
import { buildMemory, textHash, type Memory } from '../memory';
import type { CitySnapshot } from '../snapshot';

function displayedProbability(value: number | null): string {
  return value === null ? 'unavailable' : `${Math.round(value * 100)}%`;
}

function settlementMemory(entry: CitySnapshot, row: CitySnapshot['windows'][number]): Memory {
  const ranked = sources
    .filter((source) => row.forecasts[source] !== undefined)
    .sort(
      (a, b) =>
        Math.abs(row.forecasts[a]! - row.observed) - Math.abs(row.forecasts[b]! - row.observed),
    );
  const closest = ranked[0];
  const closestText = closest
    ? `; closest source ${sourceNames[closest]} (${row.forecasts[closest]!.toFixed(1)} mm)`
    : '; no complete model week available';
  const gfs = row.forecasts.gfs_seamless;
  const difference =
    gfs === undefined
      ? ''
      : `; GFS ran ${gfs >= row.observed ? 'wet' : 'dry'} by ${Math.abs(gfs - row.observed).toFixed(1)} mm`;
  return buildMemory(
    'settlement.note',
    entry.city.id,
    row.window.id,
    'noaa',
    `Backfill ${row.window.id} ${entry.city.name}: NOAA observed ${row.observed.toFixed(1)} mm${closestText}${difference}.`,
    { observed: row.observed, forecasts: row.forecasts, closest },
  );
}

function credibilityMemories(entry: CitySnapshot, context: string): Memory[] {
  return Object.entries(entry.weights).map(([key, weight]) => {
    const source = key as Source;
    const score = entry.scores.find((score) => score.source === source);
    const evidence =
      score && score.comparisonMae !== null
        ? `closest in ${score.wins} of last ${score.comparisonWeeks.length} backfill weeks, MAE ${score.comparisonMae!.toFixed(1)} mm`
        : 'uniform weight without history';
    return buildMemory(
      'source.credibility',
      entry.city.id,
      context,
      source,
      `${entry.city.name}: trusting ${sourceNames[source]} ${Math.round(weight! * 100)}% — ${evidence}.`,
      { ...score, weight, trainingHash: entry.trainingHash },
    );
  });
}

function journalMemories(entry: CitySnapshot, context: string): Memory[] {
  const revision = `${context}:forecast:${textHash(JSON.stringify(entry.upcoming)).slice(0, 12)}`;
  const rung = entry.probabilities.find((row) => row.threshold === 25)!;
  const records = [
    buildMemory(
      'pricing.adjustment',
      entry.city.id,
      entry.upcoming.window.id,
      revision,
      `${entry.city.name} computed-local weekly 25 mm trigger probability changes from ${displayedProbability(rung.naive)} equal-weight to ${displayedProbability(rung.weighted)} memory-weighted.`,
      { ...rung },
    ),
    buildMemory(
      'pick.logged',
      entry.city.id,
      entry.upcoming.window.id,
      revision,
      `Demo pick journal: upcoming ${entry.city.name} 25 mm trigger prediction is ${displayedProbability(rung.weighted)}.`,
      { probability: rung.weighted, threshold: 25, label: 'demo pick journal' },
    ),
  ];
  const last = entry.learning.at(-1);
  if (last)
    records.push(
      buildMemory(
        'pick.scored',
        entry.city.id,
        last.week,
        context,
        `Demo pick journal backfill: walk-forward 25 mm prediction ${displayedProbability(last.memoryOn)}; observed trigger ${last.observed ? 'yes' : 'no'}.`,
        { ...last, label: 'demo pick journal backfill' },
      ),
    );
  return records;
}

/** Format source, settlement and demo journal records; raw rainfall remains in mm and probabilities in 0..1. */
export function recordsForCity(entry: CitySnapshot): Memory[] {
  const { city, windows, scores, weights, trainingHash } = entry;
  const latest = windows.at(-1)!;
  const best = [...scores].sort((a, b) => a.mae - b.mae)[0];
  const latestSource = [...scores]
    .sort((a, b) => a.mae - b.mae)
    .find((score) => latest.forecasts[score.source] !== undefined)?.source;
  const contextHash = textHash(
    JSON.stringify({ trainingHash, sources: Object.keys(weights).sort() }),
  );
  const context = `${windows[0].window.id}..${latest.window.id}:${contextHash.slice(0, 12)}`;
  const records = [
    buildMemory(
      'observed.total',
      city.id,
      latest.window.id,
      'noaa',
      `${city.name} NOAA observed ${latest.observed.toFixed(1)} mm in backfill ${latest.window.id}.`,
      { total: latest.observed },
    ),
  ];
  if (latestSource)
    records.push(
      buildMemory(
        'source.forecast',
        city.id,
        latest.window.id,
        latestSource,
        `${sourceNames[latestSource]} via Open-Meteo historical forecast predicted ${latest.forecasts[latestSource]!.toFixed(1)} mm in ${city.name} backfill ${latest.window.id}.`,
        { total: latest.forecasts[latestSource] },
      ),
    );
  if (best)
    records.push(
      buildMemory(
        'source.score',
        city.id,
        context,
        best.source,
        `${sourceNames[best.source]} had MAE ${best.mae.toFixed(1)} mm across ${best.n} ${city.name} backfill weeks.`,
        { ...best },
      ),
    );
  records.push(...credibilityMemories(entry, context));
  records.push(
    ...(city.id === 'nyc' ? windows : [latest]).map((row) => settlementMemory(entry, row)),
  );
  if (city.id === 'nyc') records.push(...journalMemories(entry, context));
  return records;
}
