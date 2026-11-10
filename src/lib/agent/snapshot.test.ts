import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { atomicJson } from './snapshot';
it('writes JSON that can be consumed directly, without a formatting repair step', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'skyhedge-snapshot-'));
  try {
    const path = join(directory, 'snapshot.json');
    await atomicJson(path, { observed: 12.5 });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ observed: 12.5 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
