import type { Bus } from '@hsos/contracts/bus';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import type { TerminalId } from '@hsos/contracts/ids';
import type { AppError, Result } from '@hsos/contracts/result';

/** The sessions of a project with the ids of their live terminals (SESS-30). A copy of the sessions module's helper. */
export async function loadSessions(bus: Bus, project: ProjectInfo): Promise<Result<SessionListItem[]>> {
  const terminals = await bus.call(terminalChannels.list, { projectId: project.id });
  const liveTerminalIds = terminals.ok ? terminals.value.map((terminal) => terminal.id) : [];
  return bus.call(sessionsChannels.list, { projectPath: project.path, liveTerminalIds });
}

/** The owner's sentence for a git error (git.md "UI"). Null when no message is shown (GIT_OFFLINE). */
export function gitMessage(error: AppError): string | null {
  switch (error.code) {
    case 'GIT_DIRTY_TREE':
      return 'Commit or discard your changes before pulling.';
    case 'GIT_CONFLICT':
      return 'Your branch and GitHub have both changed. Merge them in a terminal, then sync again.';
    case 'GIT_AUTH_REQUIRED':
      return 'GitHub needs you to sign in.';
    case 'GIT_OFFLINE':
      return null;
    case 'GIT_REFUSED_UNSAFE':
      return 'HSOS does not run commands that rewrite or discard history.';
    default:
      return error.message;
  }
}

/** Sends text to a terminal the way a paste does: bracketed, and without pressing Enter (REV-33). */
export function pasteBracketed(bus: Bus, id: TerminalId, text: string) {
  return bus.call(terminalChannels.write, { id, data: `\u001b[200~${text}\u001b[201~`, source: 'owner' });
}
