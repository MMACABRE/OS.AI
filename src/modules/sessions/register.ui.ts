import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { toAbsPath } from '@hsos/contracts/ids';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { zAbsPath, zClaudeSessionId, zTerminalId } from '@hsos/contracts/schemas';
import { ToastProvider } from '@hsos/ui-kit';
import { SessionHistory } from './panel/SessionHistory';
import { SessionPicker } from './panel/SessionPicker';
import { SessionReader } from './panel/SessionReader';

export const HISTORY_PANEL = 'sessions.history';
export const TRANSCRIPT_PANEL = 'sessions.transcript';
export const FIND_COMMAND = 'sessions.find';

const ReaderState = z.object({
  sessionId: zClaudeSessionId,
  title: z.string().max(80),
  cwd: zAbsPath,
  hasOriginal: z.boolean(),
  liveTerminalId: zTerminalId.nullable(),
  note: z.string().max(2000),
});
type ReaderState = z.infer<typeof ReaderState>;

/**
 * The sessions renderer side (card 032): the session picker dialog (`sessions.find`), the Session History
 * panel (`sessions.history`) and the transcript reader (`sessions.transcript`).
 */
export function register(ctx: UiContext): void {
  const openTranscript = (item: SessionListItem) =>
    ctx.openPanel<ReaderState>(TRANSCRIPT_PANEL, {
      sessionId: item.sessionId,
      title: item.title,
      cwd: item.cwd,
      hasOriginal: item.hasOriginal,
      liveTerminalId: item.liveTerminalId,
      note: item.note,
    });

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
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };
    root.render(
      createElement(
        ToastProvider,
        null,
        createElement(SessionPicker, {
          bus: ctx.bus,
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
    component: () => createElement(SessionHistory, { bus: ctx.bus, openTranscript }),
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
    component: (props: PanelProps<ReaderState>) => createElement(SessionReader, { bus: ctx.bus, session: props.state }),
  });
}
