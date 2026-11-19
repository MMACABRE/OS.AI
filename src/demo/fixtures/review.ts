import type { ModuleFixtures } from '../demo-transport';
import { ago, MIN, p } from './world';

const file = (rel: string, change: 'added' | 'modified' | 'deleted', added: number, removed: number) => ({
  path: p(rel),
  relPath: rel,
  change,
  linesAdded: added,
  linesRemoved: removed,
  isBinary: false,
});

const COMMENTS = [
  {
    id: 'cmnt00000001',
    target: {
      kind: 'diff-line',
      path: p('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts'),
      line: 121,
      side: 'after',
      quote: 'out[i] = Math.min(mixed, cap[i % 4]);',
    },
    text: 'Keep the cap per channel; a single luminance cap would tint the steam.',
    createdAt: ago(12 * MIN),
  },
  {
    id: 'cmnt00000002',
    target: { kind: 'artifact', path: p('docs/release/stage-u-preview.png') },
    text: 'The ribbon in this shot still blinks after Claude stops.',
    createdAt: ago(8 * MIN),
  },
];

/** The `review` channels: Claude's changes since the session started, and two pinned comments. */
export const reviewFixtures: ModuleFixtures = {
  requests: {
    'review.listChanges': [
      file('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts', 'modified', 3, 1),
      file('src/modules/hud/panel/SessionRibbon.tsx', 'modified', 2, 2),
      file('docs/release/stage-u.md', 'added', 24, 0),
    ],
    'review.getDiff': {
      before: '    out[i] = base[i] + steam * glow;\n',
      after:
        '    const mixed = base[i] + steam * glow;\n    // UI-34: never brighter than 0.6 of the accent.\n    out[i] = Math.min(mixed, cap[i % 4]);\n',
      isBinary: false,
    },
    'review.listComments': COMMENTS,
    'review.addComment': (payload: { target: unknown; text: string }) => ({
      id: 'cmnt00000003',
      target: payload.target,
      text: payload.text,
      createdAt: ago(0),
    }),
    'review.updateComment': (payload: { id: string; text: string }) => ({
      ...(COMMENTS.find((comment) => comment.id === payload.id) ?? COMMENTS[0]),
      text: payload.text,
    }),
    'review.removeComment': {},
    'review.clearComments': {},
    'review.composePrompt':
      'Please address these review comments:\n\n1. phosphor-dust.ts line 121: Keep the cap per channel; a single luminance cap would tint the steam.\n2. stage-u-preview.png: The ribbon in this shot still blinks after Claude stops.\n',
  },
};
