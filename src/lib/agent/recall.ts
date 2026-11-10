import { blend } from '../blend';
import { sources } from '../cities';
import { explain } from '../explain';
import { demoProfile, type MemoryClient, recallRecords, recalledWeights } from '../memory';
import type { Snapshot } from '../snapshot';

import { profileNamespace } from '../memory';
/** Apply only validated recalled credibility and recall the demo profile. */
export async function applyRecall(client: MemoryClient, snapshot: Snapshot) {
  if (client) {
    for (const entry of snapshot.cities) {
      try {
        const context = snapshot.memories.written.find(
          (m) => m.city === entry.city.id && m.type === 'source.credibility',
        )!.window;
        const available = sources.filter((s) => entry.upcoming.forecasts[s] !== undefined);
        const recalled = await recallRecords(
          client,
          `Which forecast source was most accurate for ${entry.city.name} rain? Credibility ${context}`,
          undefined,
          (m) => recalledWeights(m, entry.city.id, context, available, entry.trainingHash) !== null,
        );
        snapshot.memories.recalled.push(recalled);
        const weights = recalledWeights(
          recalled.parsed,
          entry.city.id,
          context,
          available,
          entry.trainingHash,
        );
        if (weights) {
          entry.weights = weights;
          entry.credibilityMode = 'recalled';
          entry.probabilities = blend(entry.upcoming.forecasts, entry.scores, weights);
          entry.explanations = explain(entry.city.name, entry.scores, weights);
        }
      } catch (error) {
        entry.warnings.push(
          `Walrus recall unavailable: ${error instanceof Error ? error.message : 'remote error'}; using computed-local weights.`,
        );
      }
    }
  }
  try {
    const profile = await recallRecords(
      client,
      'Demo profile home city weekly threshold Central Park plan',
      profileNamespace,
      (records) => demoProfile(records) !== null,
    );
    snapshot.memories.recalled.push(profile);
  } catch (error) {
    snapshot.errors.push({
      city: 'demo-profile',
      message:
        error instanceof Error
          ? error.message
          : 'Profile recall unavailable; using local demo profile.',
    });
  }
}
