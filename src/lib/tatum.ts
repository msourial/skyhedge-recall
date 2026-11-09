import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { retry, HttpError, sleep } from './retry';
export class TatumClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = -Infinity;
  private cache = new Map<string, { at: number; value: unknown }>();
  constructor(private key: string, private fetcher = fetch, private pause = sleep, private now = Date.now) {}
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const cacheKey = JSON.stringify([method, params]); const cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.at < 60000) return cached.value as T;
    const task = this.queue.catch(() => {}).then(async () => {
      const again = this.cache.get(cacheKey); if (again && this.now() - again.at < 60000) return again.value as T;
      const result = await retry(async () => {
        await this.pause(Math.max(0, 500 - (this.now() - this.lastStart))); this.lastStart = this.now();
        const response = await this.fetcher('https://sui-mainnet.gateway.tatum.io', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.key }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new HttpError(response.status, `Tatum HTTP ${response.status}`);
        const body = await response.json() as { result?: T; error?: { code: number; message: string } };
        if (body.error) throw new HttpError(body.error.code === 429 ? 429 : 400, `Tatum RPC ${body.error.code}: ${body.error.message}`);
        if (!('result' in body)) throw new Error('Tatum response missing result'); return body.result as T;
      }, { sleep: this.pause });
      this.cache.set(cacheKey, { at: this.now(), value: result }); return result;
    });
    this.queue = task; return task;
  }
}
export type ChainSnapshot = { status: 'not-captured' | 'captured' | 'error'; message?: string; via?: 'tatum'; fetchedAt?: string; reads?: Record<string, { fetchedAt: string; via: 'tatum'; value: unknown }> };
export function delegateAddress(env: Record<string, string | undefined> = process.env): string | null {
  if (env.MEMWAL_PRIVATE_KEY) {
    const key = env.MEMWAL_PRIVATE_KEY;
    return Ed25519Keypair.fromSecretKey(key.startsWith('suiprivkey') ? key : Uint8Array.from(Buffer.from(key.replace(/^0x/, ''), 'hex'))).toSuiAddress();
  }
  if (env.MEMWAL_AGENT_ID) { const key = env.MEMWAL_AGENT_ID; return new Ed25519PublicKey(/^(0x)?[a-f\d]{64}$/i.test(key) ? Uint8Array.from(Buffer.from(key.replace(/^0x/, ''), 'hex')) : key).toSuiAddress(); }
  return null;
}
let shared: TatumClient | undefined;
export async function captureChain(env: Record<string, string | undefined> = process.env, provided?: TatumClient): Promise<ChainSnapshot> {
  if (!env.TATUM_API_KEY) return { status: 'not-captured', message: 'Not captured yet (run agent with TATUM_API_KEY)' };
  const client = provided ?? (shared ??= new TatumClient(env.TATUM_API_KEY));
  const reads: NonNullable<ChainSnapshot['reads']> = {};
  async function read(name: string, method: string, params: unknown[] = []) { const value = await client.call(method, params); reads[name] = { fetchedAt: new Date().toISOString(), via: 'tatum', value }; return value; }
  try {
    await read('checkpoint', 'sui_getLatestCheckpointSequenceNumber'); await read('chainIdentifier', 'sui_getChainIdentifier');
    const delegate = delegateAddress(env); if (delegate) await read('delegateBalance', 'suix_getBalance', [delegate]);
    if (env.MEMWAL_ACCOUNT_ID) {
      const object = await read('account', 'sui_getObject', [env.MEMWAL_ACCOUNT_ID, { showOwner: true, showType: true, showContent: true }]) as { data?: { owner?: { AddressOwner?: string } } };
      const owner = object.data?.owner?.AddressOwner; if (owner) await read('ownerBalance', 'suix_getBalance', [owner]);
      await read('transactions', 'suix_queryTransactionBlocks', [{ filter: { InputObject: env.MEMWAL_ACCOUNT_ID }, options: { showInput: true } }, null, 5, true]);
    }
    return { status: 'captured', fetchedAt: new Date().toISOString(), via: 'tatum', reads };
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'Chain read failed', via: 'tatum', fetchedAt: new Date().toISOString(), reads }; }
}
