import { createElement } from 'react';
import { z } from 'zod';
import { ReviewBase } from '@hsos/contracts/channels/review';
import type { AbsPath } from '@hsos/contracts/ids';
import { toAbsPath } from '@hsos/contracts/ids';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { zAbsPath } from '@hsos/contracts/schemas';
import { ChangesView } from './panel/ChangesView';
import { DiffPanel } from './panel/DiffPanel';
import { TrayCount } from './panel/TrayCount';

export const CHANGES_PANEL = 'review.changes';
export const DIFF_PANEL = 'review.diff';

const DiffState = z.object({
  path: zAbsPath,
  base: ReviewBase,
  mode: z.enum(['inline', 'split']),
});
type DiffState = z.infer<typeof DiffState>;

/** The review renderer side: the Changes side view, the diff panel and the tray count (REV-10 to REV-37). Card 033. */
export function register(ctx: UiContext): void {
  const openFile = (path: AbsPath) => ctx.openPanel('files.viewer', { path, line: null });
  const openHistory = (path: AbsPath) => ctx.openPanel('history.timeline', { path, selectedId: null });
  const openDiff = (path: AbsPath, base: ReviewBase) => ctx.openPanel(DIFF_PANEL, { path, base, mode: 'inline' });

  ctx.registerCommand({
    id: 'review.showChanges',
    title: 'Show Changes',
    defaultKey: 'Ctrl+Shift+G',
    global: false,
    run: () => ctx.openPanel(CHANGES_PANEL),
  });

  ctx.registerPanel({
    type: CHANGES_PANEL,
    kind: 'side',
    title: 'Changes',
    icon: 'changes',
    stateSchema: z.object({}),
    initialState: {},
    allowMultiple: false,
    component: () => createElement(ChangesView, { bus: ctx.bus, openFile, openDiff, openHistory }),
  });

  ctx.registerPanel<DiffState>({
    type: DIFF_PANEL,
    kind: 'dock',
    title: 'Diff',
    icon: 'file-code',
    stateSchema: DiffState,
    initialState: { path: toAbsPath('C:\\'), base: { kind: 'last-commit' }, mode: 'inline' },
    allowMultiple: true,
    component: (props: PanelProps<DiffState>) =>
      createElement(DiffPanel, { bus: ctx.bus, path: props.state.path, base: props.state.base }),
  });

  ctx.registerStatusItem({
    id: 'review.tray',
    side: 'left',
    order: 20,
    component: () => createElement(TrayCount, { bus: ctx.bus }),
  });
}
