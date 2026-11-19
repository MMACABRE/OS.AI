import { create } from 'zustand';
import type { Bus } from '@hsos/contracts/bus';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import type { ClaudeSession } from '@hsos/contracts/channels/claude-link';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import type { TerminalId } from '@hsos/contracts/ids';

type HudData = {
  readonly sessions: ReadonlyMap<string, ClaudeSession>;
  readonly project: ProjectInfo | null;
  readonly repo: RepoStatus | null;
};

/** What the HUD's parts read: live sessions from claude-link, the open project and its git status. */
export const useHudData = create<HudData>(() => ({ sessions: new Map(), project: null, repo: null }));

/** The ribbon's session for a terminal: its newest bound session that has not ended (HUD-80, SESS-11). */
export function sessionForTerminal(
  sessions: ReadonlyMap<string, ClaudeSession>,
  terminalId: TerminalId,
): ClaudeSession | null {
  let best: ClaudeSession | null = null;
  for (const session of sessions.values()) {
    if (session.terminalId !== terminalId || session.activity === 'ended') continue;
    if (best === null || session.startedAt > best.startedAt) best = session;
  }
  return best;
}

/** Loads and follows the HUD's data over the bus. Called once by the HUD's `register`. */
export function startHudData(bus: Bus): void {
  const set = useHudData.setState;
  void bus.call(claudeLinkChannels.listSessions, {}).then((result) => {
    if (result.ok) set({ sessions: new Map(result.value.map((session) => [session.sessionId, session])) });
  });
  bus.on(claudeLinkChannels.sessionChanged, (session) =>
    set((state) => ({ sessions: new Map(state.sessions).set(session.sessionId, session) })),
  );
  bus.on(claudeLinkChannels.sessionRemoved, ({ sessionId }) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(sessionId);
      return { sessions };
    }),
  );

  const loadRepo = (project: ProjectInfo | null) => {
    set({ project, repo: null });
    if (project === null) return;
    void bus.call(gitChannels.getStatus, { root: project.path }).then((result) => {
      if (result.ok && useHudData.getState().project?.path === project.path) set({ repo: result.value });
    });
  };
  void bus.call(workspaceChannels.getCurrentProject, {}).then((result) => {
    if (result.ok) loadRepo(result.value);
  });
  bus.on(workspaceChannels.projectChanged, loadRepo);
  bus.on(gitChannels.statusChanged, (status) => {
    if (status.kind === 'repo' && status.root === useHudData.getState().project?.path) set({ repo: status });
  });
}
