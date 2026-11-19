import { createElement } from 'react';
import type { AbsPath } from '@hsos/contracts/ids';
import type { UiContext } from '@hsos/contracts/module';
import { runGitCommand } from './panel/actions';
import { ChangesStatus } from './panel/ChangesStatus';

/** The review diff panel's type, opened from the status item. Defined by the review module. */
const REVIEW_DIFF = 'review.diff';

/** The git renderer side: the changes status item and the sync and fetch commands (git.md "UI"). Card 033. */
export function register(ctx: UiContext): void {
  ctx.registerStatusItem({
    id: 'git.changes',
    side: 'left',
    order: 10,
    component: () =>
      createElement(ChangesStatus, {
        bus: ctx.bus,
        openDiff: (path: AbsPath) => ctx.openPanel(REVIEW_DIFF, { path, base: { kind: 'last-commit' }, mode: 'inline' }),
      }),
  });

  ctx.registerCommand({
    id: 'git.sync',
    title: 'Sync with GitHub',
    defaultKey: 'Ctrl+Shift+S',
    global: false,
    run: () => runGitCommand(ctx.bus, 'sync'),
  });
  ctx.registerCommand({
    id: 'git.fetch',
    title: 'Fetch',
    defaultKey: null,
    global: false,
    run: () => runGitCommand(ctx.bus, 'fetch'),
  });
}
