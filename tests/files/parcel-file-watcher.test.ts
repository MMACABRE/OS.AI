import { mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createParcelFileWatcher } from '../../src/modules/files/service/parcel-file-watcher';

type Change = { path: string; kind: 'created' | 'changed' | 'deleted' };

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** Resolves when a change matching `test` arrives, or rejects after 2 000 ms. */
function waitFor(changes: Change[], test: (change: Change) => boolean): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (changes.some(test)) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - started > 2_000) {
        clearInterval(poll);
        reject(new Error(`no matching change; saw ${JSON.stringify(changes)}`));
      }
    }, 20);
  });
}

describe('parcel file watcher (card 004)', () => {
  it('reports create, change, rename and delete in nested folders, and nothing under an excluded folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'hsos-watch-'));
    folders.push(root);
    const changes: Change[] = [];
    const stop = await createParcelFileWatcher().watch(root, ['node_modules'], (batch) => changes.push(...batch));
    const file = join(root, 'a', 'b', 'c.txt');
    const renamed = join(root, 'a', 'b', 'd.txt');

    mkdirSync(join(root, 'a', 'b'), { recursive: true });
    writeFileSync(file, 'one');
    await waitFor(changes, (change) => change.path === file && change.kind === 'created');

    writeFileSync(file, 'two');
    await waitFor(changes, (change) => change.path === file && change.kind === 'changed');

    renameSync(file, renamed);
    await waitFor(changes, (change) => change.path === renamed && change.kind === 'created');
    await waitFor(changes, (change) => change.path === file && change.kind === 'deleted');

    unlinkSync(renamed);
    await waitFor(changes, (change) => change.path === renamed && change.kind === 'deleted');

    mkdirSync(join(root, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'x', 'y.txt'), 'ignored');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await stop();

    expect(changes.filter((change) => change.path.includes('node_modules'))).toEqual([]);
  }, 20_000);
});
