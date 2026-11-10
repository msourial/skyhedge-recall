import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { captureChain } from '../src/lib/agent/chain';
import { fetchCity } from '../src/lib/agent/fetch';
import { recordsForCity } from '../src/lib/agent/memories';
import { applyRecall } from '../src/lib/agent/recall';
import { atomicJson } from '../src/lib/agent/snapshot';
import { cities } from '../src/lib/cities';
import { buildMemory, createMemoryClient, rememberRecords, type Ledger } from '../src/lib/memory';
import type { Snapshot } from '../src/lib/snapshot';
config({ path: '.env.local', quiet: true });
const dryRun =
  process.argv.includes('--dry-run') ||
  !process.env.MEMWAL_PRIVATE_KEY ||
  !process.env.MEMWAL_ACCOUNT_ID;
// Remote writes require a separate explicit operator opt-in, in addition to credentials.
if (!dryRun && !process.argv.includes('--allow-mainnet-writes'))
  throw new Error(
    'Remote writes require --allow-mainnet-writes after explicit authorization; use agent:dry for data only.',
  );
const now = new Date();
const snapshot: Snapshot = {
  generatedAt: now.toISOString(),
  mode: dryRun ? 'dry-run' : 'live',
  cities: [],
  errors: [],
  memories: { mode: dryRun ? 'dry-run' : 'live', written: [], results: [], recalled: [] },
  chain: { status: 'not-captured', message: 'Not captured yet (run agent with TATUM_API_KEY)' },
};
for (const city of cities) {
  console.log(`Fetching ${city.name}...`);
  try {
    const entry = await fetchCity(city, now);
    snapshot.cities.push(entry);
    console.log(`${city.name}: ${entry.windows.length} complete backfill weeks`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    snapshot.errors.push({ city: city.id, message });
    console.error(`${city.name}: ${message}`);
  }
}
snapshot.memories.written = snapshot.cities.flatMap(recordsForCity);
if (snapshot.cities.some((c) => c.city.id === 'nyc'))
  snapshot.memories.written.push(
    buildMemory(
      'profile.home_city',
      'nyc',
      'demo',
      'profile',
      'Demo profile: home city is New York.',
    ),
    buildMemory(
      'profile.risk_appetite',
      'nyc',
      'demo',
      'profile',
      'Demo profile: wants rain cover on weekly windows at or above 25 mm.',
      { threshold: 25 },
    ),
    buildMemory(
      'profile.plan',
      'nyc',
      'demo',
      'profile',
      'Demo profile: plans an outdoor wedding in Central Park.',
    ),
  );
const ledger = JSON.parse(await readFile('data/memory-ledger.json', 'utf8')) as Ledger;
let client: ReturnType<typeof createMemoryClient> = null;
try {
  client = dryRun ? null : createMemoryClient();
  snapshot.memories.results = await rememberRecords(
    client,
    snapshot.memories.written,
    ledger,
    (value) => atomicJson('data/memory-ledger.json', value),
    dryRun,
  );
} catch (error) {
  snapshot.errors.push({
    city: 'memory-write',
    message: error instanceof Error ? error.message : 'Memory write failed',
  });
} finally {
  if (client) await applyRecall(client, snapshot);
  client?.destroy();
}
snapshot.chain = await captureChain();
await atomicJson('data/snapshot.json', snapshot);
console.log(`Snapshot saved: ${snapshot.cities.length} cities; ${snapshot.errors.length} errors.`);
if (!snapshot.cities.length) process.exitCode = 1;
