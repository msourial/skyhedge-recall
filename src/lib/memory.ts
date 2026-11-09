import { createHash } from 'node:crypto';
import { MemWal } from '@mysten-incubation/memwal';
import { sources, type Source } from './cities';
import type { Weights } from './credibility';
import { retry, sleep } from './retry';
export const namespace = 'skyhedge-recall:forecaster';
export const profileNamespace = 'skyhedge-recall:profile:demo';
export const memoryTypes = ['source.forecast', 'observed.total', 'source.score', 'source.credibility', 'settlement.note', 'pricing.adjustment', 'profile.home_city', 'profile.risk_appetite', 'profile.plan', 'pick.logged', 'pick.scored'] as const;
export type MemoryType = typeof memoryTypes[number];
export type Memory = { id: string; type: MemoryType; city: string; window: string; source: string; namespace: string; sentence: string; data: Record<string, unknown>; text: string };
export function buildMemory(type: MemoryType, city: string, window: string, source: string, sentence: string, data: Record<string, unknown> = {}): Memory {
  const id = `sr:${type}:${city}:${window}:${source}`;
  const ns = type.startsWith('profile.') || type.startsWith('pick.') ? profileNamespace : namespace;
  return { id, type, city, window, source, namespace: ns, sentence, data, text: `[${type}] [${city}] [${window}] [${source}] [${id}] ${sentence} | data=${JSON.stringify(data)}` };
}
export function parseMemory(text: string): Memory | null {
  const match = /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.*?) \| data=(\{.*\})$/.exec(text);
  if (!match || !memoryTypes.includes(match[1] as MemoryType)) return null;
  try {
    const data: unknown = JSON.parse(match[7]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const memory = buildMemory(match[1] as MemoryType, match[2], match[3], match[4], match[6], data as Record<string, unknown>);
    return memory.id === match[5] ? memory : null;
  } catch { return null; }
}
export function recalledWeights(memories: Memory[], city: string, window: string, available: Source[], trainingHash: string): Weights | null {
  const records = memories.filter(m => m.type === 'source.credibility' && m.city === city && m.window === window && m.data.trainingHash === trainingHash);
  const weights: Weights = {};
  for (const source of available) {
    const record = records.find(m => m.source === source); const weight = record?.data.weight;
    if (!sources.includes(source) || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) return null;
    weights[source] = weight;
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return sum > 0 && Math.abs(sum - 1) < 1e-6 ? weights : null;
}
export const textHash = (text: string) => createHash('sha256').update(text).digest('hex');
export type Ledger = Record<string, { textHash: string; status: 'pending' | 'done'; job_id?: string; blob_id?: string }>;
export type MemoryClient = Pick<MemWal, 'remember' | 'waitForRememberJob' | 'recall'>;
export function createMemoryClient(env: Record<string, string | undefined> = process.env): MemWal | null {
  return env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID ? MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz', namespace }) : null;
}
export async function rememberRecords(client: MemoryClient | null, records: Memory[], ledger: Ledger, persist: (ledger: Ledger) => Promise<void>, dryRun: boolean) {
  const results: { id: string; status: string }[] = [];
  for (const record of records) {
    if (dryRun || !client) { console.log(`[dry-run] ${record.text}`); results.push({ id: record.id, status: 'dry-run' }); continue; }
    const hash = textHash(record.text); const old = ledger[record.id];
    if (old && old.textHash !== hash) throw new Error(`Memory id has changed content: ${record.id}`);
    if (old?.status === 'done') { results.push({ id: record.id, status: 'skipped' }); continue; }
    const entry = old ?? { textHash: hash, status: 'pending' as const };
    ledger[record.id] = entry; await persist(ledger);
    if (!entry.job_id) {
      const accepted = await retry(() => client.remember(record.text, record.namespace, { idempotencyKey: textHash(record.namespace + record.id + hash), dedupe: true }));
      entry.job_id = accepted.job_id; await persist(ledger);
    }
    const done = await client.waitForRememberJob(entry.job_id, { timeoutMs: 90000, pollIntervalMs: 1500 });
    entry.status = 'done'; entry.blob_id = done.blob_id; await persist(ledger); results.push({ id: record.id, status: 'done' });
  }
  return results;
}
export async function recallRecords(client: MemoryClient, query: string, ns = namespace, ready: (memories: Memory[]) => boolean = m => m.length > 0, pause = sleep) {
  for (let attempt = 0; ; attempt++) {
    const result = await retry(() => client.recall({ query, limit: 100, namespace: ns }));
    const parsed = result.results.map(hit => parseMemory(hit.text)).filter((m): m is Memory => m !== null);
    if (ready(parsed) || attempt === 4) return { query, namespace: ns, recalledAt: new Date().toISOString(), results: result.results, parsed };
    await pause(1000 * 2 ** attempt);
  }
}
