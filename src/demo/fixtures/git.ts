import type { ModuleFixtures } from '../demo-transport';
import { ago, HSOS, MIN } from './world';

const file = (path: string, staged: string, unstaged: string, isUntracked = false) => ({
  path,
  originalPath: null,
  staged,
  unstaged,
  isUntracked,
  isConflicted: false,
});

/** The hsos repo: on `feat/phosphor-dust`, one ahead, five changed files, with a GitHub web URL. */
export const REPO_STATUS = {
  kind: 'repo',
  root: HSOS.path,
  branch: 'feat/phosphor-dust',
  upstream: 'origin/feat/phosphor-dust',
  ahead: 1,
  behind: 0,
  files: [
    file('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts', 'unmodified', 'modified'),
    file('src/modules/hud/panel/SessionRibbon.tsx', 'modified', 'unmodified'),
    file('src/modules/hud/panel/SessionRibbon.module.css', 'modified', 'modified'),
    file('docs/release/stage-u.md', 'unmodified', 'added', true),
    file('src/demo/fixtures/old-world.ts', 'deleted', 'unmodified'),
  ],
  operation: 'none',
  lastFetchAt: ago(4 * MIN),
  isOffline: false,
  remoteUrl: 'git@github.com:hsos-owner/hsos.git',
  webUrl: 'https://github.com/hsos-owner/hsos',
  busy: 'none',
} as const;

const DIFF_BEFORE = `export function mixSteam(base: Float32Array, steam: Float32Array, glow: number, out: Float32Array) {
  for (let i = 0; i < base.length; i += 1) {
    out[i] = base[i] + steam[i] * glow;
  }
}
`;
const DIFF_AFTER = `export function mixSteam(base: Float32Array, steam: Float32Array, glow: number, out: Float32Array, cap: Float32Array) {
  for (let i = 0; i < base.length; i += 1) {
    const mixed = base[i] + steam[i] * glow;
    // UI-34: never brighter than 0.6 of the accent, per channel.
    out[i] = Math.min(mixed, cap[i % 4]);
  }
}
`;

/** The `git` channels. */
export const gitFixtures: ModuleFixtures = {
  requests: {
    'git.getStatus': REPO_STATUS,
    'git.refresh': REPO_STATUS,
    'git.fetch': { ...REPO_STATUS, lastFetchAt: ago(0) },
    'git.pull': REPO_STATUS,
    'git.commit': { ...REPO_STATUS, ahead: 2, files: REPO_STATUS.files.slice(3) },
    'git.push': { ...REPO_STATUS, ahead: 0 },
    'git.sync': { ...REPO_STATUS, ahead: 0, lastFetchAt: ago(0) },
    'git.suggestMessage': 'fix(ui-kit): cap dust brightness behind the terminal',
    'git.getFileDiff': { before: DIFF_BEFORE, after: DIFF_AFTER, isBinary: false },
    'git.listWorktrees': [
      { path: HSOS.path, name: 'hsos', branch: 'feat/phosphor-dust', isMain: true },
      { path: `${HSOS.path}-worktrees\\ribbon`, name: 'ribbon', branch: 'feat/ribbon-blink', isMain: false },
    ],
    'git.addWorktree': (payload: { name: string }) => ({
      path: `${HSOS.path}-worktrees\\${payload.name}`,
      name: payload.name,
      branch: payload.name,
      isMain: false,
    }),
    'git.removeWorktree': {},
    'git.getGitHubAccount': { cliInstalled: true, login: 'hsos-owner' },
  },
};
