import { recentSessionsType } from './panel/widgets/RecentWidget';
import { dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import { contributeUi } from '@hsos/ui-kit';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { SessionListItem } from '@hsos/contracts/channels/sessions';
import { toAbsPath } from '@hsos/contracts/ids';
import type { TerminalId } from '@hsos/contracts/ids';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { zClaudeSessionId } from '@hsos/contracts/schemas';
import { TOAST_MS, ToastProvider } from '@hsos/ui-kit';
import { SessionHistory } from './panel/SessionHistory';
import { SessionPicker } from './panel/SessionPicker';
import { SessionReader } from './panel/SessionReader';

export const HISTORY_PANEL = 'sessions.history';
export const TRANSCRIPT_PANEL = 'sessions.transcript';
export const FIND_COMMAND = 'sessions.find';

// The reader keeps these fields of a list row; their limits come from the contract.
const ReaderState = SessionListItem.pick({
  sessionId: true,
  title: true,
  cwd: true,
  hasOriginal: true,
  liveTerminalId: true,
  note: true,
});
type ReaderState = z.infer<typeof ReaderState>;

/**
 * The sessions renderer side (card 032): the session picker dialog (`sessions.find`), the Session History
 * panel (`sessions.history`) and the transcript reader (`sessions.transcript`).
 */
export function register(ctx: UiContext): void {
  contributeUi(dashboardWidgets, recentSessionsType(ctx.bus, () => ctx.openPanel(HISTORY_PANEL)));
  const openTranscript = (item: SessionListItem) =>
    ctx.openPanel<ReaderState>(TRANSCRIPT_PANEL, {
      sessionId: item.sessionId,
      title: item.title,
      cwd: item.cwd,
      hasOriginal: item.hasOriginal,
      liveTerminalId: item.liveTerminalId,
      note: item.note,
    });

  // The state shape of the terminal module's `terminal.shell` panel (TerminalPanelState), written out here
  // because a module may not import another module.
  const openTerminal = (terminalId: TerminalId, cwd: string) =>
    ctx.openPanel('terminal.shell', { terminalId, cwd, worktree: null, launch: null, fontSizeDelta: 0 });

  // The picker is a dialog, so it mounts its own React root (SESS-31). One at a time.
  let pickerOpen = false;
  const openPicker = () => {
    if (pickerOpen) return;
    pickerOpen = true;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const close = () => {
      pickerOpen = false;
      // Only the dialog goes; the toast provider stays so a toast shown at close time still lasts its time.
      window.setTimeout(() => {
        root.render(createElement(ToastProvider, null));
        window.setTimeout(() => {
          root.unmount();
          host.remove();
        }, TOAST_MS + 1_000);
      }, 0);
    };
    root.render(
      createElement(
        ToastProvider,
        null,
        createElement(SessionPicker, {
          bus: ctx.bus,
          openTerminal,
          onClose: close,
          openTranscript: (item: SessionListItem) => {
            close();
            openTranscript(item);
          },
        }),
      ),
    );
  };

  ctx.registerCommand({
    id: FIND_COMMAND,
    title: 'Find Claude Session',
    defaultKey: 'Ctrl+Shift+R',
    global: false,
    run: openPicker,
  });
  ctx.registerCommand({
    id: 'sessions.history',
    title: 'Show Session History',
    defaultKey: null,
    global: false,
    run: () => ctx.openPanel(HISTORY_PANEL),
  });

  ctx.registerPanel({
    type: HISTORY_PANEL,
    kind: 'dock',
    title: 'Session History',
    icon: 'history',
    stateSchema: z.object({}),
    initialState: {},
    allowMultiple: false,
    component: () => createElement(SessionHistory, { bus: ctx.bus, openTranscript, openTerminal }),
  });

  const none = zClaudeSessionId.parse('none');
  ctx.registerPanel<ReaderState>({
    type: TRANSCRIPT_PANEL,
    kind: 'dock',
    title: 'Transcript',
    icon: 'file-markdown',
    stateSchema: ReaderState,
    initialState: { sessionId: none, title: '', cwd: toAbsPath('C:\\'), hasOriginal: false, liveTerminalId: null, note: '' },
    allowMultiple: true,
    component: (props: PanelProps<ReaderState>) => createElement(SessionReader, { bus: ctx.bus, session: props.state, openTerminal }),
  });
}
