import { terminalChannels, terminalSection } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { UiContext } from '@hsos/contracts/module';
import {
  createTerminalPanel,
  INITIAL_TERMINAL_STATE,
  TerminalPanelState,
} from './panel/TerminalPanel';

/** The panel type of a terminal (terminal.md "Panel"). */
export const TERMINAL_PANEL = 'terminal.shell';

/**
 * Renderer side of the terminal: the `terminal.shell` dock panel and `terminal.new`. At start it
 * reattaches a panel to every running shell of the open project (TERM-21), so shells kept by pty-host
 * show again after the window reloads.
 */
export function register(ctx: UiContext): void {
  const settings = ctx.settings(terminalSection);
  ctx.registerPanel({
    type: TERMINAL_PANEL,
    kind: 'dock',
    title: 'Terminal',
    icon: 'terminal',
    stateSchema: TerminalPanelState,
    initialState: INITIAL_TERMINAL_STATE,
    component: createTerminalPanel({
      bus: ctx.bus,
      log: ctx.log,
      settings: () => settings.get(),
      openSettings: () => ctx.openPanel('settings.screen'),
    }),
    allowMultiple: true,
  });
  ctx.registerCommand({
    id: 'terminal.new',
    title: 'New Terminal',
    defaultKey: 'Ctrl+Shift+T',
    global: false,
    run: () => ctx.openPanel(TERMINAL_PANEL, INITIAL_TERMINAL_STATE),
  });

  void (async () => {
    const project = await ctx.bus.call(workspaceChannels.getCurrentProject, {});
    if (!project.ok || project.value === null) return;
    const listed = await ctx.bus.call(terminalChannels.list, { projectId: project.value.id });
    if (!listed.ok) return;
    for (const terminal of listed.value.filter((entry) => entry.state === 'running'))
      ctx.openPanel(TERMINAL_PANEL, {
        ...INITIAL_TERMINAL_STATE,
        terminalId: terminal.id,
        cwd: terminal.cwd,
        worktree: terminal.worktree,
        launch: terminal.launch,
      });
  })();
}
