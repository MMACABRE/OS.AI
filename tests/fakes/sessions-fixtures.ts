import { SessionRecord, sessionsChannels, TranscriptItem } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { TerminalInfo, terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { PROJECT } from './fixtures';
import { createStubBus } from './stub-bus';
import type { StubBus } from './stub-bus';

export const NEW_TERMINAL = 'terminal-nw1';

export function terminalInfo(id: string) {
  return TerminalInfo.parse({
    id,
    projectId: PROJECT.id,
    cwd: PROJECT.path,
    shellPath: 'pwsh.exe',
    worktree: null,
    launch: null,
    startedAt: 1_000,
    cols: 120,
    rows: 30,
    state: 'running',
    exitCode: null,
  });
}

/** A session record built through the contract schema. */
export function record(id: string, input: Record<string, unknown> = {}): SessionRecord {
  return SessionRecord.parse({
    version: 1,
    sessionId: id,
    cwd: PROJECT.path,
    terminalId: null,
    boundAt: 1_000,
    transcriptPath: null,
    title: id,
    startedAt: 1_000,
    lastActiveAt: 2_000,
    state: 'running',
    endReason: null,
    backupBytes: 0,
    ...input,
  });
}

export function transcriptItem(
  index: number,
  role: 'user' | 'assistant' | 'tool',
  text: string,
): TranscriptItem {
  return TranscriptItem.parse({ index, role, time: null, text });
}

/**
 * A bus for the sessions panels: the open project, a terminal list, and `sessions.list` answering from
 * `items()` (read at each call, so a test can change it).
 */
export function sessionsBus(items: () => readonly SessionListItem[]): StubBus {
  const bus = createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(terminalChannels.list, () => ok([]));
  bus.answer(sessionsChannels.list, () => ok([...items()]));
  bus.answer(terminalChannels.create, () => ok(terminalInfo(NEW_TERMINAL)));
  bus.answer(sessionsChannels.bind, () => ok({}));
  bus.answer(terminalChannels.write, () => ok({}));
  bus.answer(sessionsChannels.restoreTranscript, () => ok({ path: PROJECT.path }));
  return bus;
}
