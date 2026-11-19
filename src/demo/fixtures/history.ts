import type { ModuleFixtures } from '../demo-transport';
import { HASH } from './files';
import { ago, MIN, p } from './world';

type Source = 'baseline' | 'hsos-save' | 'external' | 'restore' | 'deleted';

const snapshot = (n: number, rel: string, minutesAgo: number, source: Source) => ({
  id: `snap${String(n).padStart(8, '0')}`,
  path: p(rel),
  hash: HASH,
  time: ago(minutesAgo * MIN),
  size: 1_800 + n * 37,
  source,
});

const DUST = 'src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts';

/** Local history: the dust scene's versions as Claude worked on it, plus a deleted file. */
export const SNAPSHOTS = [
  snapshot(12, DUST, 1, 'external'),
  snapshot(7, DUST, 29, 'external'),
  snapshot(6, DUST, 33, 'external'),
  snapshot(2, DUST, 4 * 60, 'hsos-save'),
  snapshot(1, DUST, 9 * 60, 'baseline'),
  snapshot(8, 'src/demo/fixtures/old-world.ts', 26, 'deleted'),
  snapshot(10, 'src/modules/hud/panel/SessionRibbon.module.css', 6, 'hsos-save'),
];

const VERSIONS: Readonly<Record<string, string>> = {
  snap00000012: 'out[i] = Math.min(base[i] + steam[i] * glow, cap[i % 4]);\n',
  snap00000007: 'const mixed = base[i] + steam[i] * glow;\nout[i] = Math.min(mixed, cap[i % 4]);\n',
  snap00000006: 'out[i] = base[i] + steam[i] * glow;\n',
};

/** The `history` channels. */
export const historyFixtures: ModuleFixtures = {
  requests: {
    'history.listForFile': (payload: { path: string }) =>
      SNAPSHOTS.filter((item) => item.path === payload.path),
    'history.listRecent': (payload: { limit: number }) => SNAPSHOTS.slice(0, payload.limit),
    'history.readText': (payload: { id: string }) =>
      VERSIONS[payload.id] ?? 'export const world = { projects: 1 };\n',
    'history.getPrevious': (payload: { id: string }) => {
      const index = SNAPSHOTS.findIndex((item) => item.id === payload.id);
      const current = SNAPSHOTS[index];
      return SNAPSHOTS.slice(index + 1).find((item) => item.path === current?.path) ?? null;
    },
    'history.restore': { path: p(DUST), hash: HASH, modifiedAt: ago(0), size: 1_950 },
    'history.restoreDeleted': {
      path: p('src/demo/fixtures/old-world.ts'),
      hash: HASH,
      modifiedAt: ago(0),
      size: 2_100,
    },
    'history.snapshotNow': null,
    'history.getUsage': { snapshots: 1_284, bytes: 18_400_000 },
    'history.prune': {},
  },
};
