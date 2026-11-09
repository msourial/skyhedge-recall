import { config } from 'dotenv';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { cities, sources, sourceNames, type Source } from '../src/lib/cities';
import { addDays, backfillWindows, localDate, totalForWindow, upcomingWindow } from '../src/lib/windows';
import { fetchNoaa } from '../src/lib/noaa';
import { fetchForecast } from '../src/lib/openmeteo';
import { scoreSources, type Sample } from '../src/lib/scoring';
import { credibility } from '../src/lib/credibility';
import { blend } from '../src/lib/blend';
import { explain } from '../src/lib/explain';
import { buildMemory, createMemoryClient, recallRecords, recalledWeights, rememberRecords, textHash, type Ledger, type Memory } from '../src/lib/memory';
import { captureChain } from '../src/lib/tatum';
import type { CitySnapshot, Snapshot } from '../src/lib/snapshot';
config({ path: '.env.local', quiet: true });
const dryRun = process.argv.includes('--dry-run') || !process.env.MEMWAL_PRIVATE_KEY || !process.env.MEMWAL_ACCOUNT_ID;
// Remote writes require a separate explicit operator opt-in, in addition to credentials.
if (!dryRun && !process.argv.includes('--allow-mainnet-writes')) throw new Error('Remote writes require --allow-mainnet-writes after explicit authorization; use agent:dry for data only.');
async function atomicJson(path: string, value: unknown) { await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n'); await rename(`${path}.tmp`, path); }
const now = new Date();
const snapshot: Snapshot = { generatedAt: now.toISOString(), mode: dryRun ? 'dry-run' : 'live', cities: [], errors: [], memories: { mode: dryRun ? 'dry-run' : 'live', written: [], results: [], recalled: [] }, chain: { status: 'not-captured', message: 'Not captured yet (run agent with TATUM_API_KEY)' } };
for (const city of cities) {
  console.log(`Fetching ${city.name}...`);
  try {
    const today = localDate(now, city.timezone); const candidates = backfillWindows(today, 14); const upcoming = upcomingWindow(today);
    const observed = await fetchNoaa(city, candidates[0].start, addDays(today, -1));
    if (!Object.keys(observed.values).length) throw new Error('NOAA station returned no usable precipitation data');
    const historical = await fetchForecast(city, candidates[0].start, addDays(today, -1), true);
    const forward = await fetchForecast(city, upcoming.start, upcoming.end, false);
    const windows = candidates.flatMap(window => {
      const total = totalForWindow(observed.values, window); if (total === null) return [];
      const forecasts = Object.fromEntries(sources.flatMap(source => { const n = totalForWindow(historical.values[source], window); return n === null ? [] : [[source, n]]; })) as Partial<Record<Source, number>>;
      return [{ window, observed: total, forecasts }];
    }).slice(-10);
    if (!windows.length) throw new Error('No complete NOAA backfill weeks in requested range');
    const samples = Object.fromEntries(sources.map(source => [source, windows.flatMap(w => w.forecasts[source] === undefined ? [] : [{ window: w.window.id, observed: w.observed, forecast: w.forecasts[source]! }])])) as Record<Source, Sample[]>;
    const scores = scoreSources(samples);
    const forecasts = Object.fromEntries(sources.flatMap(source => { const n = totalForWindow(forward.values[source], upcoming); return n === null ? [] : [[source, n]]; })) as Partial<Record<Source, number>>;
    const available = sources.filter(s => forecasts[s] !== undefined);
    if (!available.length) throw new Error('No complete forward forecast for upcoming dates');
    const weights = credibility(scores, available);
    const entry: CitySnapshot = { city, fetchedAt: new Date().toISOString(), provenance: { observed: observed.url, historical: historical.url, forward: forward.url, forecastLabel: 'Model forecasts via Open-Meteo historical forecast; historical windows are backfill' }, windows, upcoming: { window: upcoming, forecasts }, scores, weights, credibilityMode: 'computed-local', probabilities: blend(forecasts, scores, weights), explanations: explain(city.name, scores, weights), trainingHash: textHash(JSON.stringify(samples)), warnings: sources.filter(s => !available.includes(s)).map(s => `${s}: incomplete forward forecast; excluded`) };
    snapshot.cities.push(entry);
    console.log(`${city.name}: ${windows.length} complete backfill weeks, ${available.length} forward sources`);
  } catch (error) { const message = error instanceof Error ? error.message : String(error); snapshot.errors.push({ city: city.id, message }); console.error(`${city.name}: ${message}`); }
}
function recordsForCity(entry: CitySnapshot): Memory[] {
  const { city, windows, scores, weights, upcoming, trainingHash } = entry;
  const best = [...scores].sort((a, b) => a.mae - b.mae)[0]; const latest = windows.at(-1)!;
  const latestSource = [...scores].sort((a, b) => a.mae - b.mae).find(s => latest.forecasts[s.source] !== undefined)?.source;
  const context = `${windows[0].window.id}..${latest.window.id}:${trainingHash.slice(0, 12)}`;
  const records = [
    buildMemory('observed.total', city.id, latest.window.id, 'noaa', `${city.name} NOAA observed ${latest.observed} mm in backfill ${latest.window.id}.`, { total: latest.observed }),
    ...(latestSource ? [buildMemory('source.forecast', city.id, latest.window.id, latestSource, `${sourceNames[latestSource]} via Open-Meteo historical forecast predicted ${latest.forecasts[latestSource]} mm in ${city.name} backfill ${latest.window.id}.`, { total: latest.forecasts[latestSource] })] : []),
    buildMemory('source.score', city.id, context, best.source, `${sourceNames[best.source]} had MAE ${best.mae.toFixed(2)} mm across ${best.n} ${city.name} backfill weeks.`, { ...best }),
    ...Object.entries(weights).map(([source, weight]) => buildMemory('source.credibility', city.id, context, source, `${city.name} credibility for ${sourceNames[source as Source]} is ${(weight! * 100).toFixed(2)}% from backfill inverse MAE.`, { weight, trainingHash })),
    buildMemory('settlement.note', city.id, latest.window.id, 'noaa', `${city.name} backfill ${latest.window.id} is settled from complete NOAA daily observations.`, { observed: latest.observed }),
  ];
  if (city.id === 'nyc') {
    const rung = entry.probabilities.find(p => p.threshold === 25)!;
    records.push(buildMemory('pricing.adjustment', city.id, upcoming.window.id, context, `New York computed-local weekly 25 mm trigger probability changes from ${rung.naive} equal-weight to ${rung.weighted} memory-weighted.`, { ...rung }));
    records.push(buildMemory('pick.logged', city.id, upcoming.window.id, context, `Demo pick journal: upcoming New York 25 mm trigger prediction is ${rung.weighted}.`, { probability: rung.weighted, threshold: 25, label: 'demo pick journal' }));
    const prior = windows.slice(0, -1); const lastForecasts = latest.forecasts;
    const priorSamples = Object.fromEntries(sources.map(s => [s, prior.flatMap(w => w.forecasts[s] === undefined ? [] : [{ window: w.window.id, observed: w.observed, forecast: w.forecasts[s]! }])])) as Record<Source, Sample[]>;
    const priorScores = scoreSources(priorSamples); const priorWeights = credibility(priorScores, sources.filter(s => lastForecasts[s] !== undefined));
    const prediction = blend(lastForecasts, priorScores, priorWeights).find(p => p.threshold === 25)!.weighted;
    const outcome = latest.observed >= 25;
    records.push(buildMemory('pick.scored', city.id, latest.window.id, context, `Demo pick journal backfill: walk-forward 25 mm prediction ${prediction}; observed trigger ${outcome}.`, { probability: prediction, outcome, brier: prediction === null ? null : (prediction - Number(outcome)) ** 2, label: 'demo pick journal backfill', trainingWindows: prior.map(w => w.window.id) }));
  }
  return records;
}
snapshot.memories.written = snapshot.cities.flatMap(recordsForCity);
if (snapshot.cities.some(c => c.city.id === 'nyc')) snapshot.memories.written.push(
  buildMemory('profile.home_city', 'nyc', 'demo', 'profile', 'Demo profile: home city is New York.'),
  buildMemory('profile.risk_appetite', 'nyc', 'demo', 'profile', 'Demo profile: wants rain cover on weekly windows at or above 25 mm.', { threshold: 25 }),
  buildMemory('profile.plan', 'nyc', 'demo', 'profile', 'Demo profile: plans an outdoor wedding in Central Park.'),
);
const ledger = JSON.parse(await readFile('data/memory-ledger.json', 'utf8')) as Ledger;
const client = dryRun ? null : createMemoryClient();
try {
  snapshot.memories.results = await rememberRecords(client, snapshot.memories.written, ledger, value => atomicJson('data/memory-ledger.json', value), dryRun);
  if (client) {
    for (const entry of snapshot.cities) {
      const context = snapshot.memories.written.find(m => m.city === entry.city.id && m.type === 'source.credibility')!.window;
      const available = sources.filter(s => entry.upcoming.forecasts[s] !== undefined);
      const recalled = await recallRecords(client, `Which forecast source was most accurate for ${entry.city.name} rain? Credibility ${context}`, undefined, m => recalledWeights(m, entry.city.id, context, available, entry.trainingHash) !== null);
      snapshot.memories.recalled.push(recalled);
      const weights = recalledWeights(recalled.parsed, entry.city.id, context, available, entry.trainingHash);
      if (weights) { entry.weights = weights; entry.credibilityMode = 'recalled'; entry.probabilities = blend(entry.upcoming.forecasts, entry.scores, weights); entry.explanations = explain(entry.city.name, entry.scores, weights); }
    }
  }
} finally { client?.destroy(); }
snapshot.chain = await captureChain();
await atomicJson('data/snapshot.json', snapshot);
console.log(`Snapshot saved: ${snapshot.cities.length} cities; ${snapshot.errors.length} errors.`);
if (!snapshot.cities.length) process.exitCode = 1;
