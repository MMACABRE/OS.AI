import type { ModuleFixtures } from '../demo-transport';
import { ago, DAY, HOUR, MIN, p, SESSIONS } from './world';

type Cause = 'owner' | 'claude' | 'outside';

const entry = (
  n: number,
  rel: string,
  minutesAgo: number,
  change: 'created' | 'changed' | 'deleted' | 'restored',
  cause: Cause,
  session: { id: string; title: string } | null,
  added: number | null,
  removed: number | null,
) => ({
  snapshotId: `snap${String(n).padStart(8, '0')}`,
  path: p(rel),
  relPath: rel,
  time: ago(minutesAgo * MIN),
  change,
  cause,
  sessionId: session?.id ?? null,
  sessionTitle: session?.title ?? null,
  linesAdded: added,
  linesRemoved: removed,
});

/** Recent changes in the hsos project, mostly by Claude, some by the owner and one from outside. */
export const TIMELINE = [
  entry(
    12,
    'src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts',
    1,
    'changed',
    'claude',
    SESSIONS.dust,
    3,
    1,
  ),
  entry(11, 'src/modules/hud/panel/SessionRibbon.tsx', 4, 'changed', 'claude', SESSIONS.ribbon, 2, 2),
  entry(10, 'src/modules/hud/panel/SessionRibbon.module.css', 6, 'changed', 'owner', null, 5, 1),
  entry(9, 'docs/release/stage-u.md', 18, 'created', 'claude', SESSIONS.release, 24, 0),
  entry(8, 'src/demo/fixtures/old-world.ts', 26, 'deleted', 'owner', null, 0, 88),
  entry(
    7,
    'src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts',
    29,
    'changed',
    'claude',
    SESSIONS.dust,
    1,
    1,
  ),
  entry(
    6,
    'src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts',
    33,
    'changed',
    'claude',
    SESSIONS.dust,
    4,
    2,
  ),
  entry(5, 'package-lock.json', 70, 'changed', 'outside', null, null, null),
  entry(4, 'CLAUDE.md', 5 * 60, 'changed', 'owner', null, 3, 1),
  entry(3, 'src/ui/app-root.tsx', 6 * 60, 'restored', 'owner', null, 12, 30),
];

const artifact = (
  rel: string,
  kind: 'html' | 'pdf' | 'image' | 'video',
  size: number,
  modifiedAgo: number,
  pinned: boolean,
) => ({
  path: p(rel),
  relPath: rel,
  kind,
  size,
  modifiedAt: ago(modifiedAgo),
  sessionId: kind === 'html' ? SESSIONS.release.id : SESSIONS.dust.id,
  sessionTitle: kind === 'html' ? SESSIONS.release.title : SESSIONS.dust.title,
  isPinned: pinned,
});

export const ARTIFACTS = [
  artifact('design-round/dashboard/phosphor.html', 'html', 84_000, 20 * MIN, true),
  artifact('docs/release/stage-u-preview.png', 'image', 412_000, 18 * MIN, false),
  artifact('out/dust-capture.webm', 'video', 3_400_000, 2 * HOUR, false),
  artifact('docs/spec-print.pdf', 'pdf', 1_250_000, 2 * DAY, false),
];

/** The `activity` channels. */
export const activityFixtures: ModuleFixtures = {
  requests: {
    'activity.listTimeline': (payload: { cause: Cause | null; sessionId: string | null; limit: number }) =>
      TIMELINE.filter(
        (item) =>
          (payload.cause === null || item.cause === payload.cause) &&
          (payload.sessionId === null || item.sessionId === payload.sessionId),
      ).slice(0, payload.limit),
    'activity.listArtifacts': (payload: { query: string }) =>
      ARTIFACTS.filter((item) => item.relPath.toLowerCase().includes(payload.query.toLowerCase())),
    'activity.pinArtifact': {},
    'activity.dismissArtifact': {},
  },
};
