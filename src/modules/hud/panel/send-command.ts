import type { Bus } from '@hsos/contracts/bus';
import type { ClaudeSession } from '@hsos/contracts/channels/claude-link';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { TerminalId } from '@hsos/contracts/ids';
import type { ToastApi } from '@hsos/ui-kit';

/** HUD-68: a command word the quick bar may send. Settings reject anything else; this checks again. */
export const QUICK_WORD = /^\/?[a-z][a-z0-9:._[\]-]{0,60}$/;

/** HUD-68: the compact field loses its line breaks and control characters before it is sent. */
export function cleanFreeText(text: string): string {
  const spaced = [...text].map((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  });
  return spaced.join('').replace(/ {2,}/g, ' ').trim();
}

/** Focuses a terminal panel's input, if it is on screen. */
export function focusTerminal(terminalId: TerminalId): void {
  const input = document.querySelector<HTMLElement>(`[data-terminal-id="${terminalId}"] textarea`);
  input?.focus();
}

export type SendResult = 'blocked' | 'ran' | 'typed';

/**
 * Sends a slash command to a session's terminal (HUD-63). Enter is pressed only when nothing was typed
 * into Claude's input since its last reply; otherwise the command is typed and the owner presses Enter.
 * A session that needs the owner gets nothing. HSOS never presses Enter on text it did not write itself.
 */
export async function sendToSession(
  bus: Bus,
  session: ClaudeSession,
  command: string,
  toast: ToastApi,
): Promise<SendResult> {
  const terminalId = session.terminalId;
  if (terminalId === null) return 'blocked';
  if (session.activity === 'needs-you' || session.activity === 'ended') {
    toast.show({
      tone: 'info',
      message: 'Claude is waiting for you in the terminal. Answer it first.',
      action: { label: 'Go to terminal', onPress: () => focusTerminal(terminalId) },
    });
    return 'blocked';
  }
  let canRun = false;
  if (session.activity === 'idle' || session.activity === 'done') {
    const last = await bus.call(terminalChannels.getLastOwnerInput, { id: terminalId });
    const replied = Math.max(session.lastResponseAt ?? 0, session.startedAt);
    canRun = last.ok && (last.value.at === null || last.value.at < replied);
  }
  if (canRun) {
    await bus.call(terminalChannels.write, { id: terminalId, data: `${command}\r`, source: 'quick-command' });
    focusTerminal(terminalId);
    return 'ran';
  }
  await bus.call(terminalChannels.write, { id: terminalId, data: command, source: 'owner' });
  toast.show({ tone: 'info', message: `Typed ${command}. Press Enter in the terminal to run it.` });
  focusTerminal(terminalId);
  return 'typed';
}
