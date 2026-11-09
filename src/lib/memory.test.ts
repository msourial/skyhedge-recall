import { describe, expect, it, vi } from 'vitest';
import { buildMemory, memoryTypes, parseMemory, profileNamespace, recalledWeights, recallRecords, rememberRecords, textHash, type Ledger, type MemoryClient } from './memory';
import { HttpError, retry } from './retry';
function mockClient(): MemoryClient {
  return { remember: vi.fn().mockResolvedValue({ job_id: 'job', status: 'pending' }), waitForRememberJob: vi.fn().mockResolvedValue({ id: 'job', blob_id: 'blob', namespace: 'ns', owner: 'owner' }), recall: vi.fn().mockResolvedValue({ results: [], total: 0 }) } as unknown as MemoryClient;
}
const record = buildMemory('source.credibility', 'nyc', '2026-W44', 'gfs_seamless', 'Backfill credibility.', { weight: 1, trainingHash: 'hash' });
describe('memory formatting and recalled weights', () => {
  it.each(memoryTypes)('round trips %s with tags and a stable id', type => {
    const memory = buildMemory(type, 'nyc', '2026-W44', 'gfs_seamless', 'Real backfill data.', { total: 12.5 });
    expect(parseMemory(memory.text)).toEqual(memory);
    if (type.startsWith('profile.') || type.startsWith('pick.')) expect(memory.namespace).toBe(profileNamespace);
  });
  it('rejects malformed content, unknown types and mismatched ids', () => {
    expect(parseMemory('unstructured')).toBeNull(); expect(parseMemory(record.text.replace('sr:source', 'sr:other'))).toBeNull();
    expect(parseMemory(record.text.replace('data={', 'data={bad'))).toBeNull();
  });
  it('requires matching city, training data and complete valid weights', () => {
    expect(recalledWeights([record], 'nyc', '2026-W44', ['gfs_seamless'], 'hash')).toEqual({ gfs_seamless: 1 });
    expect(recalledWeights([record], 'seattle', '2026-W44', ['gfs_seamless'], 'hash')).toBeNull();
    expect(recalledWeights([record], 'nyc', '2026-W44', ['gfs_seamless'], 'stale')).toBeNull();
    expect(recalledWeights([record], 'nyc', '2026-W44', ['gfs_seamless', 'gem_seamless'], 'hash')).toBeNull();
  });
});
describe('ledger', () => {
  it('persists accepted jobs and completion, then skips completed ids', async () => {
    const client = mockClient(); const ledger: Ledger = {}; const persist = vi.fn().mockResolvedValue(undefined);
    await rememberRecords(client, [record], ledger, persist, false);
    expect(ledger[record.id]).toEqual({ textHash: textHash(record.text), status: 'done', job_id: 'job', blob_id: 'blob' });
    expect(persist).toHaveBeenCalledTimes(3);
    await rememberRecords(client, [record], ledger, persist, false); expect(client.remember).toHaveBeenCalledTimes(1);
    await expect(rememberRecords(client, [{ ...record, text: record.text + 'changed' }], ledger, persist, false)).rejects.toThrow('changed content');
  });
  it('resumes an accepted job after timeout without resubmission', async () => {
    const client = mockClient(); vi.mocked(client.waitForRememberJob).mockRejectedValueOnce(new Error('timeout'));
    const ledger: Ledger = {}; const persist = vi.fn().mockResolvedValue(undefined);
    await expect(rememberRecords(client, [record], ledger, persist, false)).rejects.toThrow('timeout');
    expect(ledger[record.id].status).toBe('pending');
    await rememberRecords(client, [record], ledger, persist, false);
    expect(client.remember).toHaveBeenCalledTimes(1);
    expect(client.waitForRememberJob).toHaveBeenCalledWith('job', { timeoutMs: 90000, pollIntervalMs: 1500 });
  });
  it('dry-run leaves the ledger and remote service untouched', async () => {
    const client = mockClient(); const persist = vi.fn(); const ledger: Ledger = {};
    await rememberRecords(client, [record], ledger, persist, true);
    expect(client.remember).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled(); expect(ledger).toEqual({});
  });
  it('retries index lag until current records appear', async () => {
    const client = mockClient(); vi.mocked(client.recall).mockResolvedValueOnce({ results: [], total: 0 }).mockResolvedValue({ results: [{ text: record.text, blob_id: 'blob', distance: 0 }], total: 1 });
    const pause = vi.fn().mockResolvedValue(undefined);
    const recalled = await recallRecords(client, 'query', undefined, m => m.length > 0, pause);
    expect(recalled.parsed).toEqual([record]); expect(pause).toHaveBeenCalledWith(1000);
  });
});
describe('bounded exponential retry', () => {
  it('retries network, 429, and server failures with injected jitter', async () => {
    const op = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockRejectedValueOnce(new HttpError(429, 'limit')).mockRejectedValueOnce(new HttpError(503, 'server')).mockResolvedValue('ok');
    const pause = vi.fn().mockResolvedValue(undefined);
    expect(await retry(op, { sleep: pause, random: () => 0.5 })).toBe('ok');
    expect(pause.mock.calls.map(c => c[0])).toEqual([625, 1125, 2125]);
  });
  it('does not retry permanent errors and caps attempts', async () => {
    const pause = vi.fn().mockResolvedValue(undefined); const permanent = vi.fn().mockRejectedValue(new HttpError(401, 'auth'));
    await expect(retry(permanent, { sleep: pause })).rejects.toThrow('auth'); expect(permanent).toHaveBeenCalledTimes(1);
    const broken = vi.fn().mockRejectedValue(new Error('network'));
    await expect(retry(broken, { sleep: pause })).rejects.toThrow('network'); expect(broken).toHaveBeenCalledTimes(5);
  });
});
it('does not retry permanent SDK HTTP status errors', async () => {
  const operation = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }));
  await expect(retry(operation, { sleep: vi.fn() })).rejects.toThrow('denied');
  expect(operation).toHaveBeenCalledTimes(1);
});
