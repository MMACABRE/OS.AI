import type { UiContext } from '@hsos/contracts/module';
import { pageBeside, usePageStore } from './panel/page-store';
import type { PageId } from './panel/page-store';
import { goToPage } from './panel/page-transition';

const PAGE_COMMANDS: readonly { id: string; title: string; key: string; page: PageId }[] = [
  { id: 'workspace.pageDashboard', title: 'Go to Dashboard', key: 'Ctrl+1', page: 'dashboard' },
  { id: 'workspace.pageCode', title: 'Go to Code', key: 'Ctrl+2', page: 'code' },
  { id: 'workspace.pageNotes', title: 'Go to Notes', key: 'Ctrl+3', page: 'notes' },
];

/** The workspace's renderer side: the page commands of WS-40. The frame itself is mounted by the shell's root. */
export function register(ctx: UiContext): void {
  for (const command of PAGE_COMMANDS)
    ctx.registerCommand({
      id: command.id,
      title: command.title,
      defaultKey: command.key,
      global: true,
      run: () => goToPage(command.page),
    });
  ctx.registerCommand({
    id: 'workspace.pagePrevious',
    title: 'Previous Page',
    defaultKey: 'Ctrl+Alt+Left',
    global: true,
    run: () => goToPage(pageBeside(usePageStore.getState().page, -1)),
  });
  ctx.registerCommand({
    id: 'workspace.pageNext',
    title: 'Next Page',
    defaultKey: 'Ctrl+Alt+Right',
    global: true,
    run: () => goToPage(pageBeside(usePageStore.getState().page, 1)),
  });
}
