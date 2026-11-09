import { expect, it, vi } from 'vitest';
import saved from '../../../data/snapshot.json';
import type { Snapshot } from '../snapshot';
import { buildMemory, type MemoryClient } from '../memory';
import { HttpError } from '../retry';
import { applyRecall } from './recall';
import { recordsForCity } from './memories';
it('preserves local weather and continues city recalls when memory service rejects requests', async () => {
  const snapshot = structuredClone(saved) as unknown as Snapshot;
  const previous = snapshot.cities.map((city) => city.probabilities);
  const recall = vi.fn().mockRejectedValue(new HttpError(403, 'Unavailable'));
  await applyRecall({ recall } as unknown as MemoryClient, snapshot);
  expect(recall).toHaveBeenCalledTimes(snapshot.cities.length + 1);
  expect(snapshot.cities.map((city) => city.probabilities)).toEqual(previous);
  expect(
    snapshot.cities.every((city) =>
      city.warnings.some((warning) => warning.includes('computed-local')),
    ),
  ).toBe(true);
  expect(snapshot.errors.some((error) => error.city === 'demo-profile')).toBe(true);
});
it('gives changed forward inputs distinct journal identities and keeps identical inputs stable', () => {
  const city = structuredClone(saved.cities[0]) as unknown as Snapshot['cities'][number];
  const ids = () =>
    recordsForCity(city)
      .filter((memory) => ['pick.logged', 'pricing.adjustment'].includes(memory.type))
      .map((memory) => memory.id);
  const original = ids();
  expect(ids()).toEqual(original);
  city.upcoming.forecasts.gfs_seamless! += 0.1;
  expect(ids()).not.toEqual(original);
});

it('uses validated recalled credibility as the live numerical input', async () => {
  const snapshot = structuredClone(saved) as unknown as Snapshot;
  snapshot.cities = snapshot.cities.slice(0, 1);
  const entry = snapshot.cities[0];
  const records = snapshot.memories.written
    .filter((memory) => memory.city === entry.city.id && memory.type === 'source.credibility')
    .map((memory) =>
      buildMemory(
        memory.type,
        memory.city,
        memory.window,
        memory.source,
        'Recalled source judgment.',
        { trainingHash: entry.trainingHash, weight: memory.source === 'gfs_seamless' ? 1 : 0 },
      ),
    );
  const profile = snapshot.memories.written.filter((memory) => memory.type.startsWith('profile.'));
  const recall = vi
    .fn()
    .mockResolvedValueOnce({
      results: records.map((memory) => ({ text: memory.text })),
      total: records.length,
    })
    .mockResolvedValueOnce({
      results: profile.map((memory) => ({ text: memory.text })),
      total: profile.length,
    });
  await applyRecall({ recall } as unknown as MemoryClient, snapshot);
  expect(entry.credibilityMode).toBe('recalled');
  expect(entry.weights.gfs_seamless).toBe(1);
  expect(entry.probabilities[1].weighted).toBe(entry.probabilities[1].perSource.gfs_seamless);
  expect(snapshot.memories.recalled).toHaveLength(2);
});

it('revisions credibility identity when forward source availability changes', () => {
  const city = structuredClone(saved.cities[0]) as unknown as Snapshot['cities'][number];
  const ids = () =>
    recordsForCity(city)
      .filter((memory) => memory.type === 'source.credibility')
      .map((memory) => memory.id);
  const original = ids();
  expect(ids()).toEqual(original);
  delete city.upcoming.forecasts.gfs_seamless;
  delete city.weights.gfs_seamless;
  const total = Object.values(city.weights).reduce((sum, weight) => sum + weight, 0);
  for (const source of Object.keys(city.weights) as (keyof typeof city.weights)[])
    city.weights[source] = city.weights[source]! / total;
  expect(ids().every((id) => !original.includes(id))).toBe(true);
});
