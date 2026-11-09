import { buildMemory } from './memory';
import { expect, it } from 'vitest';
import snapshot from '../../data/snapshot.json';
import { walkForward } from './agent/score';
import type { Snapshot } from './snapshot';
import { fairPremium, viewModel } from './view-model';
it('rounds illustrative units up and preserves missing estimates', () => {
  expect(fairPremium(0.421)).toBe(43);
  expect(fairPremium(null)).toBeNull();
});
it('uses demo preferences, respects explicit city and labels local evidence', () => {
  const data = snapshot as unknown as Snapshot;
  expect(viewModel(data)?.city.city.id).toBe('nyc');
  expect(viewModel(data, 'seattle')?.city.city.id).toBe('seattle');
  expect(viewModel(data)?.rung).toBe(25);
  expect(viewModel(data)?.profileMode).toContain('not yet recalled');
});
it('never lets the held-out observation change its prediction', () => {
  const windows = (snapshot as unknown as Snapshot).cities[0].windows;
  const baseline = walkForward(windows);
  const changed = windows.map((row, index) =>
    index === 2 ? { ...row, observed: row.observed + 1000 } : row,
  );
  expect(walkForward(changed)[0].memoryOn).toBe(baseline[0].memoryOn);
  expect(baseline[0].trainingWeeks).toEqual(windows.slice(0, 2).map((row) => row.window.id));
});

it('uses recalled profile city and trigger and marks the recommendation provenance', () => {
  const data = structuredClone(snapshot) as unknown as Snapshot;
  const profile = data.memories.written.filter((memory) => memory.type.startsWith('profile.'));
  profile.find((memory) => memory.type === 'profile.home_city')!.city = 'seattle';
  profile.find((memory) => memory.type === 'profile.risk_appetite')!.data.threshold = 50;
  data.memories.recalled = [
    {
      query: 'profile',
      namespace: 'skyhedge-recall:profile:demo',
      recalledAt: data.generatedAt,
      results: [],
      parsed: profile,
    },
  ];
  const model = viewModel(data);
  expect(model?.city.city.id).toBe('seattle');
  expect(model?.rung).toBe(50);
  expect(model?.profileMode).toBe('recalled');
  expect(model?.recommendation).toContain('≥50 mm');
  expect(viewModel(data, 'nyc')?.city.city.id).toBe('nyc');
});

it('labels a stale availability-context memory as reference even when its weight matches', () => {
  const data = structuredClone(snapshot) as unknown as Snapshot;
  data.cities[0].credibilityMode = 'recalled';
  const current = data.memories.written.filter(
    (memory) => memory.city === 'nyc' && memory.type === 'source.credibility',
  );
  const record = current[0];
  const stale = buildMemory(
    record.type,
    record.city,
    'older-availability-context',
    record.source,
    record.sentence,
    record.data,
  );
  data.memories.recalled = [
    {
      query: 'weights',
      namespace: record.namespace,
      recalledAt: data.generatedAt,
      results: [],
      parsed: [...current, stale],
    },
  ];
  const model = viewModel(data);
  expect(model?.memories.find((memory) => memory.id === record.id)?.changed).toContain(
    'Sets the source weight',
  );
  expect(model?.memories.find((memory) => memory.id === stale.id)?.changed).toContain('not used');
});
