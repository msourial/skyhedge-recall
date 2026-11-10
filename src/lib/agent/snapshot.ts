import { rename, writeFile } from 'node:fs/promises';
/** Atomically replace a JSON snapshot or ledger; precipitation payloads retain raw mm. */
export async function atomicJson(path: string, value: unknown) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}
