import { createElement } from 'react';
import type { UiContext } from '@hsos/contracts/module';
import { runGitCommand } from './panel/actions';
import { ChangesStatus } from './panel/ChangesStatus';

/** The Changes side view, opened from the status item. Defined by the review module. */
const REVIEW_CHANGES = 'review.changes';

/** The git renderer side: the changes status item and the sync and fetch commands (git.md "UI"). Card 033. */
export function register(ctx: UiContext): void {
  ctx.registerStatusItem({
    id: 'git.changes',
    side: 'left',
    order: 10,
    component: () =>
      createElement(ChangesStatus, {
        bus: ctx.bus,
        openChanges: () => ctx.openPanel(REVIEW_CHANGES),
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
