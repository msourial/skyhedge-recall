import { accountOwnerAddress } from './tatum';
import { demoProfile, type Memory } from './memory';
import type { Snapshot } from './snapshot';
/** Display percent for a probability in 0..1; unavailable values stay explicit. */
export function percent(value: number | null): string {
  return value === null ? 'Unavailable' : `${Math.round(value * 100)}%`;
}
/** Fair illustrative premium in units for 100 units of cover; no money moves. */
export function fairPremium(probability: number | null): number | null {
  return probability === null ? null : Math.ceil(100 * probability);
}
function memoryEffect(memory: Memory, active: boolean): string {
  if (!active && (memory.type === 'source.credibility' || memory.type.startsWith('profile.')))
    return 'Reference record; not used by this forecast.';
  if (memory.type === 'source.credibility') return 'Sets the source weight used by memory-on.';
  if (memory.type.startsWith('profile.'))
    return 'Selects the demo city, trigger, or recommendation.';
  if (memory.type === 'settlement.note')
    return 'Records the observed outcome and closest forecast; supporting evidence.';
  return 'Provides the forecast, score, or demo journal context; supporting evidence.';
}

/** Map captured memories to demo preferences and city UI data; all rainfall units are mm. */
export function viewModel(snapshot: Snapshot, requestedCity?: string) {
  const recalled = snapshot.memories.recalled.flatMap((result) => result.parsed);
  const remoteProfile = demoProfile(recalled);
  const hasProfile = remoteProfile !== null;
  const profile = remoteProfile ?? demoProfile(snapshot.memories.written) ?? [];
  const home = profile.find((memory) => memory.type === 'profile.home_city')?.city;
  const threshold = profile.find((memory) => memory.type === 'profile.risk_appetite')?.data
    .threshold;
  const city =
    snapshot.cities.find((entry) => entry.city.id === requestedCity) ??
    snapshot.cities.find((entry) => entry.city.id === home) ??
    snapshot.cities[0];
  const rung = typeof threshold === 'number' && [10, 25, 50].includes(threshold) ? threshold : 25;
  if (!city) return null;
  const blendedMm = Object.entries(city.upcoming.forecasts).reduce(
    (sum, [source, mm]) => sum + mm * (city.weights[source as keyof typeof city.weights] ?? 0),
    0,
  );
  const active = city.probabilities.find((row) => row.threshold === rung)!;
  const delta = active.delta === null ? null : active.delta * 100;
  const mode =
    city.credibilityMode === 'recalled' ? 'recalled' : 'computed-local (not yet recalled)';
  const currentContext = snapshot.memories.written.find(
    (memory) => memory.city === city.city.id && memory.type === 'source.credibility',
  )?.window;
  return {
    city,
    rung,
    blendedMm,
    mode,
    profileMode: hasProfile ? 'recalled' : 'computed-local (not yet recalled)',
    recommendation: `${profile.find((memory) => memory.type === 'profile.plan')?.sentence ?? 'Demo profile: outdoor plan.'} Consider the ≥${rung} mm weekly rung in ${city.city.name}: memory-on estimates ${percent(active.weighted)}.`,
    changed: `Memory moved the ≥${rung} mm trigger from ${percent(active.naive)} to ${percent(active.weighted)} (${delta === null ? 'unavailable' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts`}).`,
    rungs: city.probabilities.map((row) => ({
      ...row,
      offPrice: fairPremium(row.naive),
      onPrice: fairPremium(row.weighted),
    })),
    learningSummary: city.learning.length
      ? {
          on: city.learning.reduce((sum, row) => sum + row.brierOn, 0) / city.learning.length,
          off: city.learning.reduce((sum, row) => sum + row.brierOff, 0) / city.learning.length,
        }
      : null,
    memories: [
      ...new Map(
        [...snapshot.memories.written, ...recalled].map((memory) => [
          `${memory.id}:${memory.text}`,
          memory,
        ]),
      ).values(),
    ]
      .filter((memory) => memory.city === city.city.id || profile.includes(memory))
      .map((memory) => {
        const recall = snapshot.memories.recalled.find((result) =>
          result.parsed.some((record) => record.id === memory.id && record.text === memory.text),
        );
        const activeCredibility =
          memory.type === 'source.credibility' &&
          memory.window === currentContext &&
          memory.city === city.city.id &&
          memory.data.trainingHash === city.trainingHash &&
          memory.data.weight === city.weights[memory.source as keyof typeof city.weights] &&
          (city.credibilityMode === 'recalled') === Boolean(recall);
        return {
          ...memory,
          recalled: Boolean(recall),
          recalledAt: recall?.recalledAt,
          changed: memoryEffect(memory, activeCredibility || profile.includes(memory)),
        };
      }),
  };
}

/** Shape captured GraphQL evidence for the chain panel without substituting sample values. */
export function chainViewModel(chain: import('./tatum').ChainSnapshot) {
  const reads = chain.reads ?? {};
  const network = reads.network?.value as
    | {
        chainIdentifier?: string;
        checkpoint?: { sequenceNumber: string | number; timestamp: string };
        epoch?: { epochId: string | number; referenceGasPrice: string };
      }
    | undefined;
  const walrus = reads.walrus?.value as
    { registry?: import('./tatum').ChainObject; pkg?: import('./tatum').ChainObject } | undefined;
  const account = reads.account?.value as { account?: import('./tatum').ChainObject } | undefined;
  const accountTransactions = reads.accountTransactions?.value as
    { transactions?: { nodes: { digest: string }[] } } | undefined;
  const transactions = reads.registryTransactions?.value as
    { transactions?: { nodes: { digest: string }[] } } | undefined;
  return {
    network,
    registry: walrus?.registry,
    pkg: walrus?.pkg,
    account: account?.account,
    accountOwner: account?.account ? accountOwnerAddress(account.account) : null,
    accountTransactions: accountTransactions?.transactions?.nodes ?? [],
    balances: reads.balances?.value as
      | {
          owner?: { balance?: { totalBalance: string } };
          delegate?: { balance?: { totalBalance: string } };
        }
      | undefined,
    accountConfigured: Boolean(reads.account),
    registryTime: reads.walrus?.fetchedAt,
    transactions: transactions?.transactions?.nodes ?? [],
    errors: Object.entries(reads).flatMap(([name, read]) =>
      read.error ? [`${name}: ${read.error}`] : [],
    ),
  };
}
