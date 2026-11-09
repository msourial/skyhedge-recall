import { expect, it, vi } from 'vitest';
import { captureChain, TatumClient } from './tatum';
it('sends authenticated JSON-RPC, serializes requests, retries 429, and caches', async () => {
  let now = 0; const starts: number[] = [];
  const pause = vi.fn(async (ms: number) => { now += ms; });
  const fetcher = vi.fn(async () => { starts.push(now); return starts.length === 1 ? new Response('', { status: 429 }) : Response.json({ jsonrpc: '2.0', id: 1, result: 'value' }); });
  const client = new TatumClient('test-key', fetcher, pause, () => now);
  expect(await Promise.all([client.call('first'), client.call('second')])).toEqual(['value', 'value']);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(500); expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(500);
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(init.headers).toMatchObject({ 'x-api-key': 'test-key' }); expect(JSON.parse(init.body as string)).toMatchObject({ method: 'first', params: [] });
  await client.call('first'); expect(fetcher).toHaveBeenCalledTimes(3);
  now += 60001; await client.call('first'); expect(fetcher).toHaveBeenCalledTimes(4);
});
it('rejects RPC errors without caching and recovers queue', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: -32602, message: 'invalid' } })).mockResolvedValue(Response.json({ result: 1 }));
  const client = new TatumClient('key', fetcher, async () => {});
  await expect(client.call('bad')).rejects.toThrow('invalid'); expect(await client.call('good')).toBe(1);
});
it('reports absent key honestly', async () => { expect(await captureChain({})).toEqual({ status: 'not-captured', message: 'Not captured yet (run agent with TATUM_API_KEY)' }); });
it('captures account, owner balance and account transaction reads', async () => {
  const methods: string[] = [];
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => { const body = JSON.parse(init!.body as string); methods.push(body.method); return Response.json({ result: body.method === 'sui_getObject' ? { data: { owner: { AddressOwner: '0xowner' } } } : 'value' }); });
  const result = await captureChain({ TATUM_API_KEY: 'key', MEMWAL_ACCOUNT_ID: '0xaccount' }, new TatumClient('key', fetcher, async () => {}));
  expect(result.status).toBe('captured'); expect(methods).toEqual(['sui_getLatestCheckpointSequenceNumber', 'sui_getChainIdentifier', 'sui_getObject', 'suix_getBalance', 'suix_queryTransactionBlocks']);
  expect(result.reads?.ownerBalance.via).toBe('tatum');
});
