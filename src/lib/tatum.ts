import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { fetchJson, HttpError, retry, sleep } from './retry';
/** Serialized Sui GraphQL client with 500 ms minimum request spacing and 60-second per-operation cache. */
export class TatumClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = -Infinity;
  private cache = new Map<string, { at: number; value?: unknown; error?: string }>();
  constructor(
    private key: string,
    private fetcher = fetch,
    private pause = sleep,
    private now = Date.now,
  ) {}
  /** Original response time, retained when an operation is served from cache. */
  fetchedAt(query: string, variables: Record<string, unknown> = {}): string | undefined {
    const cached = this.cache.get(JSON.stringify([query, variables]));
    return cached ? new Date(cached.at).toISOString() : undefined;
  }
  async call<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const cacheKey = JSON.stringify([query, variables]);
    const cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.at < 60000) return cached.value as T;
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        const again = this.cache.get(cacheKey);
        if (again && this.now() - again.at < 60000) return again.value as T;
        const result = await retry(
          async () => {
            await this.pause(Math.ceil(Math.max(0, 500 - (this.now() - this.lastStart))));
            this.lastStart = this.now();
            const response = await this.fetcher('https://sui-mainnet.gateway.tatum.io/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': this.key },
              body: JSON.stringify({ query, variables }),
              signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) throw new HttpError(response.status, `Tatum HTTP ${response.status}`);
            const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
            if (body.errors?.length)
              throw new HttpError(
                400,
                `Tatum GraphQL: ${body.errors.map((error) => error.message).join('; ')}`,
              );
            if (!body.data) throw new HttpError(400, 'Tatum response missing data');
            return body.data;
          },
          { sleep: this.pause },
        );
        this.cache.set(cacheKey, { at: this.now(), value: result });
        return result;
      });
    this.queue = task;
    return task;
  }
}
/** Captured raw Sui chain evidence; balances are MIST, timestamps are ISO strings, missing reads stay absent. */
export type ChainSnapshot = {
  status: 'not-captured' | 'captured' | 'error';
  message?: string;
  via?: 'tatum';
  fetchedAt?: string;
  reads?: Record<string, { fetchedAt: string; via: 'tatum'; value?: unknown; error?: string }>;
};
/** Derive the delegate Sui address from a secret key or public key; return null when neither exists. */
export function delegateAddress(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.MEMWAL_PRIVATE_KEY) {
    const key = env.MEMWAL_PRIVATE_KEY;
    return Ed25519Keypair.fromSecretKey(
      key.startsWith('suiprivkey')
        ? key
        : Uint8Array.from(Buffer.from(key.replace(/^0x/, ''), 'hex')),
    ).toSuiAddress();
  }
  if (env.MEMWAL_AGENT_ID) {
    const key = env.MEMWAL_AGENT_ID;
    return new Ed25519PublicKey(
      /^(0x)?[a-f\d]{64}$/i.test(key)
        ? Uint8Array.from(Buffer.from(key.replace(/^0x/, ''), 'hex'))
        : key,
    ).toSuiAddress();
  }
  return null;
}
export type ChainObject = {
  address: string;
  version?: string | number;
  digest?: string;
  owner?: { __typename?: string; address?: { address?: string } | string; AddressOwner?: string };
  asMoveObject?: {
    contents?: {
      type?: { repr?: string };
      json?: { owner?: string; accounts?: { size?: string } };
    };
  };
  asMovePackage?: { modules?: { nodes: { name: string }[] } };
};
/** Shared accounts store their owner in Move contents; address-owned objects expose AddressOwner. */
export function accountOwnerAddress(object: Partial<ChainObject>): string | null {
  const owner = object.owner;
  const address =
    owner?.AddressOwner ??
    (typeof owner?.address === 'string' ? owner.address : owner?.address?.address) ??
    object.asMoveObject?.contents?.json?.owner;
  return typeof address === 'string' && /^0x[0-9a-f]{1,64}$/i.test(address) ? address : null;
}
export const RELAYER_CONFIG_URL = 'https://relayer.memory.walrus.xyz/config';
/** Documented fallback deployment observed from the public mainnet relayer on 2026-11-09. */
export const FALLBACK_DEPLOYMENT = {
  packageId: '0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5',
  registryId: '0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f',
  network: 'mainnet',
};
const objectFields = `address version digest owner { __typename ... on AddressOwner { address { address } } } previousTransaction { digest effects { timestamp } } asMoveObject { contents { type { repr } json } }`;
const transactionFields = `nodes { digest sender { address } effects { status timestamp checkpoint { sequenceNumber } } }`;
let shared: TatumClient | undefined;
/** Capture public mainnet evidence with isolated errors for each operation and no chain writes. */
export async function captureChain(
  env: Record<string, string | undefined> = process.env,
  provided?: TatumClient,
  configFetcher = fetch,
): Promise<ChainSnapshot> {
  if (!env.TATUM_API_KEY)
    return { status: 'not-captured', message: 'Not captured yet (run agent with TATUM_API_KEY)' };
  const client = provided ?? (shared ??= new TatumClient(env.TATUM_API_KEY));
  const reads: NonNullable<ChainSnapshot['reads']> = {};
  async function read(name: string, query: string, variables: Record<string, unknown> = {}) {
    const fetchedAt = new Date().toISOString();
    try {
      const value = await client.call<Record<string, unknown>>(query, variables);
      reads[name] = {
        fetchedAt: client.fetchedAt(query, variables) ?? new Date().toISOString(),
        via: 'tatum',
        value,
      };
      return value;
    } catch (error) {
      reads[name] = {
        fetchedAt,
        via: 'tatum',
        error: error instanceof Error ? error.message : 'Chain read failed',
      };
      return undefined;
    }
  }
  let deployment = FALLBACK_DEPLOYMENT;
  let message: string | undefined;
  try {
    const config = await fetchJson<typeof deployment>(RELAYER_CONFIG_URL, undefined, configFetcher);
    if (
      config.network !== 'mainnet' ||
      ![config.packageId, config.registryId].every((id) => /^0x[0-9a-f]{64}$/i.test(id))
    )
      throw new Error('Invalid mainnet deployment');
    deployment = {
      packageId: config.packageId,
      registryId: config.registryId,
      network: config.network,
    };
  } catch {
    message = 'Relayer config unavailable; using documented fallback deployment.';
  }
  const network = await read(
    'network',
    `{ chainIdentifier checkpoint { sequenceNumber digest timestamp } epoch { epochId referenceGasPrice } }`,
  );
  await read(
    'walrus',
    `query ($registry: SuiAddress!, $pkg: SuiAddress!) { registry: object(address: $registry) { ${objectFields} } pkg: object(address: $pkg) { address version asMovePackage { modules(first: 20) { nodes { name } } } } }`,
    { registry: deployment.registryId, pkg: deployment.packageId },
  );
  const checkpoint = (network?.checkpoint as { sequenceNumber?: string | number } | undefined)
    ?.sequenceNumber;
  async function transactions(name: string, address: string, window: bigint) {
    if (!checkpoint || !/^\d+$/.test(String(checkpoint))) {
      reads[name] = {
        fetchedAt: new Date().toISOString(),
        via: 'tatum',
        error: 'Latest checkpoint unavailable; bounded transaction query skipped.',
      };
      return;
    }
    const start = BigInt(checkpoint) > window ? BigInt(checkpoint) - window : 0n;
    await read(
      name,
      `query ($object: SuiAddress!) { transactions(last: 5, filter: { affectedObject: $object, afterCheckpoint: ${start} }) { ${transactionFields} } }`,
      { object: address },
    );
  }
  await transactions('registryTransactions', deployment.registryId, 100000n);
  let owner: string | null = null;
  if (env.MEMWAL_ACCOUNT_ID) {
    const account = await read(
      'account',
      `query ($account: SuiAddress!) { account: object(address: $account) { ${objectFields} } }`,
      { account: env.MEMWAL_ACCOUNT_ID },
    );
    owner = account?.account ? accountOwnerAddress(account.account as ChainObject) : null;
    await transactions('accountTransactions', env.MEMWAL_ACCOUNT_ID, 2000000n);
  }
  let delegate: string | null = null;
  try {
    delegate = delegateAddress(env);
  } catch {
    reads.delegateBalance = {
      fetchedAt: new Date().toISOString(),
      via: 'tatum',
      error: 'Invalid delegate credentials',
    };
  }
  const addresses = { ...(owner ? { owner } : {}), ...(delegate ? { delegate } : {}) };
  if (Object.keys(addresses).length)
    await read(
      'balances',
      `query (${Object.keys(addresses)
        .map((name) => `$${name}: SuiAddress!`)
        .join(', ')}) { ${Object.keys(addresses)
        .map(
          (name) =>
            `${name}: address(address: $${name}) { balance(coinType: "0x2::sui::SUI") { totalBalance } }`,
        )
        .join(' ')} }`,
      addresses,
    );
  return {
    status: network ? 'captured' : 'error',
    message,
    fetchedAt: new Date().toISOString(),
    via: 'tatum',
    reads,
  };
}
