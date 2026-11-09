import { describe, expect, it, vi } from 'vitest';
import { accountOwnerAddress, captureChain, TatumClient } from './tatum';
it('sends authenticated GraphQL, serializes requests, retries 429, and caches', async () => {
  let now = 0;
  const starts: number[] = [];
  const pause = vi.fn(async (ms: number) => {
    now += ms;
  });
  const fetcher = vi.fn(async () => {
    starts.push(now);
    return starts.length === 1
      ? new Response('', { status: 429 })
      : Response.json({ data: 'value' });
  });
  const client = new TatumClient('test-key', fetcher, pause, () => now);
  expect(await Promise.all([client.call('first'), client.call('second')])).toEqual([
    'value',
    'value',
  ]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(500);
  expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(500);
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(init.headers).toMatchObject({ 'x-api-key': 'test-key' });
  expect(JSON.parse(init.body as string)).toMatchObject({ query: 'first', variables: {} });
  await client.call('first');
  expect(fetcher).toHaveBeenCalledTimes(3);
  now += 60001;
  await client.call('first');
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it('rejects GraphQL errors without caching and recovers queue', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ errors: [{ message: 'invalid' }] }))
    .mockResolvedValue(Response.json({ data: 1 }));
  const client = new TatumClient('key', fetcher, async () => {});
  await expect(client.call('bad')).rejects.toThrow('invalid');
  expect(await client.call('good')).toBe(1);
});
it('reports absent key honestly', async () => {
  expect(await captureChain({})).toEqual({
    status: 'not-captured',
    message: 'Not captured yet (run agent with TATUM_API_KEY)',
  });
});
it('preserves successful reads when bounded transactions return GraphQL errors', async () => {
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { query } = JSON.parse(init!.body as string);
    if (query.includes('transactions('))
      return Response.json({ errors: [{ message: 'OutOfRange' }] });
    if (query.includes('chainIdentifier'))
      return Response.json({
        data: { chainIdentifier: 'mainnet', checkpoint: { sequenceNumber: '3000000' } },
      });
    if (query.includes('account: object'))
      return Response.json({
        data: { account: { asMoveObject: { contents: { json: { owner: '0xabc' } } } } },
      });
    return Response.json({ data: { registry: { address: '0xabc' } } });
  });
  const result = await captureChain(
    { TATUM_API_KEY: 'key', MEMWAL_ACCOUNT_ID: '0xabc' },
    new TatumClient('key', fetcher, async () => {}),
    vi.fn(async () =>
      Response.json({
        packageId: `0x${'a'.repeat(64)}`,
        registryId: `0x${'b'.repeat(64)}`,
        network: 'mainnet',
      }),
    ),
  );
  expect(result.status).toBe('captured');
  expect(result.reads?.registryTransactions.error).toContain('OutOfRange');
  expect(result.reads?.accountTransactions.error).toContain('OutOfRange');
  expect(result.reads?.balances.via).toBe('tatum');
  const bodies = fetcher.mock.calls.map((call) => JSON.parse(call[1]!.body as string));
  expect(
    bodies
      .filter((body) => body.query.includes('transactions('))
      .every((body) => body.query.includes('afterCheckpoint:')),
  ).toBe(true);
});
describe('accountOwnerAddress', () => {
  it('reads address-owned and shared MemWalAccount owners', () => {
    expect(
      accountOwnerAddress({ owner: { __typename: 'AddressOwner', address: { address: '0xabc' } } }),
    ).toBe('0xabc');
    expect(accountOwnerAddress({ asMoveObject: { contents: { json: { owner: '0xdef' } } } })).toBe(
      '0xdef',
    );
    expect(accountOwnerAddress({ owner: { __typename: 'Shared' } })).toBeNull();
  });
});
it('retains original response time on cached reads and retries server failures', async () => {
  let now = 1000;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValue(Response.json({ data: { ok: true } }));
  const client = new TatumClient(
    'key',
    fetcher,
    async (ms) => {
      now += ms;
    },
    () => now,
  );
  await client.call('{ ok }');
  const capturedAt = client.fetchedAt('{ ok }');
  now += 10000;
  await client.call('{ ok }');
  expect(client.fetchedAt('{ ok }')).toBe(capturedAt);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('reads delegate balance even without an account id', async () => {
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { query } = JSON.parse(init!.body as string);
    return Response.json({
      data: query.includes('chainIdentifier') ? { checkpoint: { sequenceNumber: 3000000 } } : {},
    });
  });
  const result = await captureChain(
    { TATUM_API_KEY: 'key', MEMWAL_AGENT_ID: 'a'.repeat(64) },
    new TatumClient('key', fetcher, async () => {}),
    vi.fn(async () =>
      Response.json({
        packageId: `0x${'a'.repeat(64)}`,
        registryId: `0x${'b'.repeat(64)}`,
        network: 'mainnet',
      }),
    ),
  );
  expect(result.reads?.balances.value).toEqual({});
  expect(result.reads?.account).toBeUndefined();
});
