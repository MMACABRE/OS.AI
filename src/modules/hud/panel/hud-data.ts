import { create } from 'zustand';
import type { Bus } from '@hsos/contracts/bus';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import type { ClaudeSession, LinkStatus, UsageLimits } from '@hsos/contracts/channels/claude-link';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { HudSettings } from '@hsos/contracts/channels/hud';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import type { RepoSync, SkillInfo, SkillRun } from '@hsos/contracts/channels/skills';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import type { TerminalId } from '@hsos/contracts/ids';

/** A value read over the bus: not yet known, known, or failed with a reason. */
export type Loaded<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'error'; readonly message: string };

const LOADING = { kind: 'loading' } as const;

type HudData = {
  readonly sessions: ReadonlyMap<string, ClaudeSession>;
  readonly sessionsLoaded: Loaded<true>;
  readonly project: ProjectInfo | null;
  readonly repo: RepoStatus | null;
  readonly usage: Loaded<UsageLimits>;
  readonly link: LinkStatus | null;
  readonly skills: Loaded<readonly SkillInfo[]>;
  readonly runs: ReadonlyMap<string, SkillRun>;
  readonly repoSync: Loaded<RepoSync>;
  readonly settings: HudSettings;
  /** Terminals in the order they last had focus, newest first (HUD-31). */
  readonly focusOrder: readonly TerminalId[];
  /** The sessions board lists every project, not only the open one (HUD-1). */
  readonly showAllProjects: boolean;
};

/** What the HUD's parts read: live sessions, usage, skills, the open project and its git status. */
export const useHudData = create<HudData>(() => ({
  sessions: new Map(),
  sessionsLoaded: LOADING,
  project: null,
  repo: null,
  usage: LOADING,
  link: null,
  skills: LOADING,
  runs: new Map(),
  repoSync: LOADING,
  settings: HudSettings.parse({}),
  focusOrder: [],
  showAllProjects: false,
}));

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

/**
 * The target terminal of HUD-31: the most recently focused terminal whose session has not ended; with
 * none focused yet, the terminal of the newest live session.
 */
export function targetSession(
  sessions: ReadonlyMap<string, ClaudeSession>,
  focusOrder: readonly TerminalId[],
): ClaudeSession | null {
  for (const terminalId of focusOrder) {
    const session = sessionForTerminal(sessions, terminalId);
    if (session !== null) return session;
  }
  let newest: ClaudeSession | null = null;
  for (const session of sessions.values())
    if (session.terminalId !== null && session.activity !== 'ended')
      if (newest === null || session.startedAt > newest.startedAt) newest = session;
  return newest;
}

const failed = (message: string) => ({ kind: 'error', message }) as const;
const set = useHudData.setState;

function loadSessions(bus: Bus): void {
  set({ sessionsLoaded: LOADING });
  void bus.call(claudeLinkChannels.listSessions, {}).then((result) => {
    if (result.ok)
      set({
        sessions: new Map(result.value.map((session) => [session.sessionId, session])),
        sessionsLoaded: { kind: 'ready', value: true },
      });
    else set({ sessionsLoaded: failed(result.error.message) });
  });
}

function loadSkills(bus: Bus): void {
  set({ skills: LOADING });
  void bus.call(skillsChannels.list, {}).then((result) => {
    set({ skills: result.ok ? { kind: 'ready', value: result.value } : failed(result.error.message) });
  });
}

/** Loads and follows the HUD's data over the bus. Called once by the HUD's `register`. */
export function startHudData(bus: Bus): void {
  loadSessions(bus);
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
  void bus.call(claudeLinkChannels.getStatus, {}).then((result) => {
    if (result.ok) set({ link: result.value });
  });
  bus.on(claudeLinkChannels.statusChanged, (link) => set({ link }));

  void bus.call(claudeLinkChannels.getUsageLimits, {}).then((result) => {
    set({ usage: result.ok ? { kind: 'ready', value: result.value } : failed(result.error.message) });
  });
  bus.on(claudeLinkChannels.usageLimitsChanged, (value) => set({ usage: { kind: 'ready', value } }));

  loadSkills(bus);
  bus.on(skillsChannels.listChanged, (value) => set({ skills: { kind: 'ready', value } }));
  void bus.call(skillsChannels.listRuns, {}).then((result) => {
    if (result.ok) set({ runs: new Map(result.value.map((run) => [run.id, run])) });
  });
  bus.on(skillsChannels.runChanged, (run) => set((state) => ({ runs: new Map(state.runs).set(run.id, run) })));
  void bus.call(skillsChannels.getRepoSync, {}).then((result) => {
    set({ repoSync: result.ok ? { kind: 'ready', value: result.value } : failed(result.error.message) });
  });
  bus.on(skillsChannels.repoSyncChanged, (value) => set({ repoSync: { kind: 'ready', value } }));

  const takeSettings = (raw: unknown) => {
    const parsed = HudSettings.safeParse(raw);
    if (parsed.success) set({ settings: parsed.data });
  };
  void bus.call(settingsChannels.getSection, { moduleId: 'hud' }).then((result) => {
    if (result.ok) takeSettings(result.value);
  });
  bus.on(settingsChannels.sectionChanged, ({ moduleId, value }) => {
    if (moduleId === 'hud') takeSettings(value);
  });

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

  // HUD-7, HUD-31: a terminal gaining focus becomes the newest target, and its sessions are marked seen.
  document.addEventListener('focusin', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-terminal-id]') : null;
    const terminalId = target?.getAttribute('data-terminal-id') as TerminalId | null | undefined;
    if (terminalId === null || terminalId === undefined) return;
    set((state) => ({ focusOrder: [terminalId, ...state.focusOrder.filter((id) => id !== terminalId)] }));
    for (const session of useHudData.getState().sessions.values())
      if (session.terminalId === terminalId)
        void bus.call(claudeLinkChannels.markSeen, { sessionId: session.sessionId });
  });
}

/** Reloads what failed: used by the sections' Retry buttons. */
export function retryHudData(bus: Bus, what: 'sessions' | 'skills' | 'repo'): void {
  if (what === 'sessions') loadSessions(bus);
  if (what === 'skills') loadSkills(bus);
  if (what === 'repo')
    void bus.call(skillsChannels.checkRepoSync, {}).then((result) => {
      set({ repoSync: result.ok ? { kind: 'ready', value: result.value } : failed(result.error.message) });
    });
}
