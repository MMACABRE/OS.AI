import type { Bus } from '@hsos/contracts/bus';
import { resumeCommand, sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import type { MenuItem } from '@hsos/ui-kit';

/** The sessions of one project, or of every project when `all` (SESS-30). Live terminals come from `terminal.list`. */
export async function loadSessions(
  bus: Bus,
  project: ProjectInfo | null,
  all: boolean,
): Promise<Result<SessionListItem[]>> {
  const terminals = project === null ? null : await bus.call(terminalChannels.list, { projectId: project.id });
  const liveTerminalIds = terminals?.ok === true ? terminals.value.map((terminal) => terminal.id) : [];
  return bus.call(sessionsChannels.list, {
    projectPath: all || project === null ? null : project.path,
    liveTerminalIds,
  });
}

/** The fields a resume needs (SESS-32). */
export type ResumeTarget = Pick<SessionListItem, 'sessionId' | 'cwd' | 'hasOriginal'>;

/**
 * SESS-32 "Resume in new terminal": restores the backup when the original is gone (SESS-42), opens a shell
 * in the session's folder, binds the session to it (SESS-11), and types the resume command.
 */
export async function resumeInNewTerminal(
  bus: Bus,
  project: ProjectInfo,
  target: ResumeTarget,
): Promise<Result<{ readonly terminalId: string }>> {
  if (!target.hasOriginal) {
    const restored = await bus.call(sessionsChannels.restoreTranscript, { sessionId: target.sessionId });
    if (!restored.ok) return restored;
  }
  const created = await bus.call(terminalChannels.create, {
    projectId: project.id,
    cwd: target.cwd,
    cols: 120,
    rows: 30,
    worktree: null,
    launch: null,
  });
  if (!created.ok) return created;
  const bound = await bus.call(sessionsChannels.bind, {
    sessionId: target.sessionId,
    terminalId: created.value.id,
  });
  if (!bound.ok) return bound;
  const written = await bus.call(terminalChannels.write, {
    id: created.value.id,
    data: `${resumeCommand(target.sessionId)}\r`,
    source: 'owner',
  });
  if (!written.ok) return written;
  return ok({ terminalId: created.value.id });
}

/** SESS-32 "Copy resume command": the folder change and the resume, ready to paste in any shell. */
export function copyResumeCommand(bus: Bus, item: Pick<SessionListItem, 'sessionId' | 'cwd'>) {
  return bus.call(shellChannels.writeClipboard, { text: `cd "${item.cwd}"; claude --resume ${item.sessionId}` });
}

/** The actions a session row offers. Each caller supplies the ones it can run. */
export type RowHandlers = {
  readonly resume: (item: SessionListItem) => void;
  readonly copy: (item: SessionListItem) => void;
  readonly transcript: (item: SessionListItem) => void;
  readonly rename: (item: SessionListItem) => void;
  readonly note: (item: SessionListItem) => void;
  readonly remove: (item: SessionListItem) => void;
};

/**
 * The row menu (SESS-32, SESS-73). A running session shows "Go to terminal" and "Open transcript" only (SESS-43).
 */
export function rowMenu(item: SessionListItem, handlers: RowHandlers): MenuItem[] {
  const live = item.liveTerminalId !== null;
  const actions: MenuItem[] = live
    ? [{ label: 'Go to terminal', icon: 'terminal', disabled: true, onSelect: () => undefined }]
    : [
        { label: 'Resume in new terminal', icon: 'play', onSelect: () => handlers.resume(item) },
        { label: 'Copy resume command', icon: 'copy', onSelect: () => handlers.copy(item) },
      ];
  return [
    ...actions,
    { label: 'Open transcript', icon: 'file-markdown', onSelect: () => handlers.transcript(item) },
    { separator: true },
    { label: 'Rename', icon: 'file', keyBinding: 'F2', onSelect: () => handlers.rename(item) },
    { label: 'Edit note', icon: 'comment', onSelect: () => handlers.note(item) },
    { label: 'Delete', icon: 'trash', keyBinding: 'Delete', danger: true, onSelect: () => handlers.remove(item) },
  ];
}

/** The title as the owner sees it (SESS-31). */
export const titleOf = (item: Pick<SessionListItem, 'title'>): string =>
  item.title.trim() === '' ? 'Untitled session' : item.title;

/** Every typed word must appear in the text, in any order, ignoring case (SESS-31, SESS-71). */
export function matchesSearch(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => haystack.includes(word));
}
