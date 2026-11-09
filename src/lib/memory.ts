import { MemWal } from '@mysten-incubation/memwal';
import { createHash } from 'node:crypto';
import { cities, sources, type Source } from './cities';
import type { Weights } from './credibility';
import { retry, sleep } from './retry';
export const namespace = 'skyhedge-recall:forecaster';
export const profileNamespace = 'skyhedge-recall:profile:demo';
export const memoryTypes = [
  'source.forecast',
  'observed.total',
  'source.score',
  'source.credibility',
  'settlement.note',
  'pricing.adjustment',
  'profile.home_city',
  'profile.risk_appetite',
  'profile.plan',
  'pick.logged',
  'pick.scored',
] as const;
/** Supported tagged record kinds for source learning and the explicitly labelled demo profile. */
export type MemoryType = (typeof memoryTypes)[number];
/** Human sentence plus raw structured payload; rainfall is mm and probabilities/weights are 0..1. */
export type Memory = {
  id: string;
  type: MemoryType;
  city: string;
  window: string;
  source: string;
  namespace: string;
  sentence: string;
  data: Record<string, unknown>;
  text: string;
};
/** Build a stable tagged memory; raw data retains mm and probability 0..1 values without display rounding. */
export function buildMemory(
  type: MemoryType,
  city: string,
  window: string,
  source: string,
  sentence: string,
  data: Record<string, unknown> = {},
): Memory {
  const id = `sr:${type}:${city}:${window}:${source}`;
  const ns = type.startsWith('profile.') || type.startsWith('pick.') ? profileNamespace : namespace;
  return {
    id,
    type,
    city,
    window,
    source,
    namespace: ns,
    sentence,
    data,
    text: `[${type}] [${city}] [${window}] [${source}] [${id}] ${sentence} | data=${JSON.stringify(data)}`,
  };
}
/** Parse a tagged memory and JSON payload; reject unsupported types, malformed JSON and mismatched ids. */
export function parseMemory(text: string): Memory | null {
  const match =
    /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.*?) \| data=(\{.*\})$/.exec(
      text,
    );
  if (!match || !memoryTypes.includes(match[1] as MemoryType)) return null;
  try {
    const data: unknown = JSON.parse(match[7]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const memory = buildMemory(
      match[1] as MemoryType,
      match[2],
      match[3],
      match[4],
      match[6],
      data as Record<string, unknown>,
    );
    return memory.id === match[5] ? memory : null;
  } catch {
    return null;
  }
}
/** Accept recalled weights in 0..1 only for the exact city, training hash, window and complete source set. */
export function recalledWeights(
  memories: Memory[],
  city: string,
  window: string,
  available: Source[],
  trainingHash: string,
): Weights | null {
  const records = memories.filter(
    (m) =>
      m.type === 'source.credibility' &&
      m.city === city &&
      m.window === window &&
      m.data.trainingHash === trainingHash,
  );
  if (records.some((record) => !available.includes(record.source as Source))) return null;
  const weights: Weights = {};
  for (const source of available) {
    const matches = records.filter((memory) => memory.source === source);
    if (new Set(matches.map((memory) => memory.text)).size > 1) return null;
    const record = matches[0];
    const weight = record?.data.weight;
    if (
      !sources.includes(source) ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight < 0
    )
      return null;
    weights[source] = weight;
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return sum > 0 && Math.abs(sum - 1) < 1e-6 ? weights : null;
}
/** Select a complete unambiguous demo profile; validate city and rainfall preference in mm. */
export function demoProfile(memories: Memory[]): Memory[] | null {
  const selected: Memory[] = [];
  for (const type of ['profile.home_city', 'profile.risk_appetite', 'profile.plan']) {
    const matches = memories.filter(
      (memory) =>
        memory.type === type &&
        memory.namespace === profileNamespace &&
        memory.window === 'demo' &&
        memory.source === 'profile',
    );
    const variants = new Set(
      matches.map((memory) => JSON.stringify([memory.city, memory.sentence, memory.data])),
    );
    if (variants.size !== 1) return null;
    selected.push(matches[0]);
  }
  if (!cities.some((city) => city.id === selected[0].city)) return null;
  if (
    ![10, 25, 50].includes(Number(selected[1].data.threshold)) ||
    typeof selected[1].data.threshold !== 'number'
  )
    return null;
  return selected;
}

/** Compute a SHA-256 hex digest for content validation and stable idempotency keys. */
export const textHash = (text: string) => createHash('sha256').update(text).digest('hex');
/** Per-id write ledger with content hash, durable accepted job id, completion status and optional blob id. */
export type Ledger = Record<
  string,
  { textHash: string; status: 'pending' | 'done'; job_id?: string; blob_id?: string }
>;
/** Minimal SDK interface for idempotent writing, polling and namespace-scoped recall. */
export type MemoryClient = Pick<MemWal, 'remember' | 'waitForRememberJob' | 'recall'>;
/** Create the authenticated server-side memory client or return null when required credentials are absent. */
export function createMemoryClient(
  env: Record<string, string | undefined> = process.env,
): MemWal | null {
  return env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID
    ? MemWal.create({
        key: env.MEMWAL_PRIVATE_KEY,
        accountId: env.MEMWAL_ACCOUNT_ID,
        serverUrl: env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz',
        namespace,
      })
    : null;
}
/** Persist and resume each accepted job independently; dry-run writes no remote memory. Poll delays are milliseconds. */
export async function rememberRecords(
  client: MemoryClient | null,
  records: Memory[],
  ledger: Ledger,
  persist: (ledger: Ledger) => Promise<void>,
  dryRun: boolean,
) {
  const results: { id: string; status: string }[] = [];
  for (const record of records) {
    if (dryRun || !client) {
      console.log(`[dry-run] ${record.text}`);
      results.push({ id: record.id, status: 'dry-run' });
      continue;
    }
    const hash = textHash(record.text);
    const old = ledger[record.id];
    if (old && old.textHash !== hash)
      throw new Error(`Memory id has changed content: ${record.id}`);
    if (old?.status === 'done') {
      results.push({ id: record.id, status: 'skipped' });
      continue;
    }
    const entry = old ?? { textHash: hash, status: 'pending' as const };
    ledger[record.id] = entry;
    await persist(ledger);
    if (!entry.job_id) {
      const accepted = await retry(() =>
        client.remember(record.text, record.namespace, {
          idempotencyKey: textHash(record.namespace + record.id + hash),
          dedupe: true,
        }),
      );
      entry.job_id = accepted.job_id;
      await persist(ledger);
    }
    const done = await client.waitForRememberJob(entry.job_id, {
      timeoutMs: 90000,
      pollIntervalMs: 1500,
    });
    entry.status = 'done';
    entry.blob_id = done.blob_id;
    await persist(ledger);
    results.push({ id: record.id, status: 'done' });
  }
  return results;
}
/** Recall namespace-scoped tagged records with bounded exponential index-lag waits in milliseconds. */
export async function recallRecords(
  client: MemoryClient,
  query: string,
  ns = namespace,
  ready: (memories: Memory[]) => boolean = (m) => m.length > 0,
  pause = sleep,
) {
  for (let attempt = 0; ; attempt++) {
    const result = await retry(() => client.recall({ query, limit: 100, namespace: ns }));
    const parsed = result.results
      .map((hit) => parseMemory(hit.text))
      .filter((m): m is Memory => m !== null);
    if (ready(parsed) || attempt === 4)
      return {
        query,
        namespace: ns,
        recalledAt: new Date().toISOString(),
        results: result.results,
        parsed,
      };
    await pause(1000 * 2 ** attempt);
  }
}
