import { useEffect, useState } from 'react';
import type { ClaudeSession, SessionActivity } from '@hsos/contracts/channels/claude-link';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { EmptyState, ErrorState, Menu, IconButton, Icon, Skeleton, staggerStyle, Tooltip } from '@hsos/ui-kit';
import { useHudData, retryHudData } from './hud-data';
import { useHudDeps } from './hud-context';
import { focusTerminal } from './send-command';
import { listedAgents } from './ribbon/Ribbon';
import styles from './Hud.module.css';

/** HUD-2: the order of activities on the board. */
export const ACTIVITY_ORDER: readonly SessionActivity[] = ['needs-you', 'working', 'background', 'done', 'idle', 'ended'];

/** HUD-8: how long Claude's prompt cache stays warm after a reply, in minutes. */
export const CACHE_WARM_MINUTES = 60;

const WORDS: Readonly<Record<SessionActivity, string>> = {
  'needs-you': 'needs you',
  working: 'working',
  background: 'background',
  done: 'done',
  idle: 'idle',
  ended: 'ended',
};

const DOTS: Readonly<Record<SessionActivity, string | undefined>> = {
  'needs-you': styles.dotNeedsYou,
  working: styles.dotWorking,
  background: styles.dotBackground,
  done: styles.dotDone,
  idle: styles.dotIdle,
  ended: styles.dotEnded,
};

const TONES: Readonly<Record<SessionActivity, string | undefined>> = {
  'needs-you': styles.warn,
  working: undefined,
  background: undefined,
  done: styles.ok,
  idle: styles.muted,
  ended: styles.muted,
};

/** HUD-1: sessions in the open project folder, inside it, or in one of its worktrees. */
export function inProject(session: ClaudeSession, projectPath: string | null): boolean {
  if (projectPath === null) return false;
  const cwd = session.cwd.toLowerCase();
  const root = projectPath.toLowerCase();
  // Worktrees under .claude\worktrees sit inside the project folder, so they match too.
  return cwd === root || cwd.startsWith(`${root}\\`);
}

/** HUD-2: needs-you first, then working, background, done, idle, ended; newest change first in a group. */
export function boardOrder(sessions: readonly ClaudeSession[]): ClaudeSession[] {
  const changed = (session: ClaudeSession) => Math.max(session.lastResponseAt ?? 0, session.startedAt);
  return [...sessions].sort(
    (a, b) => ACTIVITY_ORDER.indexOf(a.activity) - ACTIVITY_ORDER.indexOf(b.activity) || changed(b) - changed(a),
  );
}

/** HUD-8: `warm 52m` or `cold`, from the last reply. */
export function cacheState(lastResponseAt: number | null, now: number, warmMinutes = CACHE_WARM_MINUTES): string {
  if (lastResponseAt === null) return 'cold';
  const left = warmMinutes - Math.floor((now - lastResponseAt) / 60_000);
  return left > 0 ? `warm ${left}m` : 'cold';
}

/** HUD-9: context toned warn from 70 and danger from 90. */
export function contextToneClass(percent: number): string | undefined {
  return percent >= 90 ? styles.danger : percent >= 70 ? styles.warn : undefined;
}

const firstLine = (text: string | null) => (text ?? '').split('\n')[0] ?? '';

/** The second line's left part (HUD-3). */
function secondLeft(session: ClaudeSession, runningAgents: number): string {
  if (session.activity === 'needs-you') return session.attentionReason ?? '';
  if (session.currentTool !== null)
    return runningAgents > 0 ? `${session.currentTool} · ${runningAgents} agents` : session.currentTool;
  return firstLine(session.lastMessage);
}

/** The section menu: "Show all projects" lists every session (HUD-1). */
export function SessionsMenu() {
  const allProjects = useHudData((state) => state.showAllProjects);
  return (
    <Menu
      items={[
        {
          label: allProjects ? 'Show this project only' : 'Show all projects',
          onSelect: () => useHudData.setState({ showAllProjects: !allProjects }),
        },
      ]}
    >
      <IconButton icon={<Icon name="more" />} label="Sessions menu" onPress={() => undefined} />
    </Menu>
  );
}

/** The attention board (HUD-1 to HUD-9). */
export function SessionsBoard() {
  const deps = useHudDeps();
  const sessions = useHudData((state) => state.sessions);
  const loaded = useHudData((state) => state.sessionsLoaded);
  const link = useHudData((state) => state.link);
  const project = useHudData((state) => state.project);
  const allProjects = useHudData((state) => state.showAllProjects);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // HUD-8: the cache state is recomputed every 30 seconds; the agents' "done" timer needs seconds.
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  if (link !== null && !link.isListening)
    return (
      <ErrorState
        message="Claude Code link is off. HSOS is not receiving events from Claude Code."
        onRetry={() => retryHudData(deps.bus, 'sessions')}
      />
    );
  if (loaded.kind === 'loading') return <Skeleton rows={3} label="Reading sessions" />;
  if (loaded.kind === 'error')
    return <ErrorState message={`Claude Code link is off: ${loaded.message}`} onRetry={() => retryHudData(deps.bus, 'sessions')} />;

  const shown = boardOrder(
    [...sessions.values()].filter((session) => allProjects || inProject(session, project?.path ?? null)),
  );
  if (shown.length === 0)
    return <EmptyState title="No sessions" message="No Claude sessions. Start one with Ctrl+Shift+A." />;

  const activate = (session: ClaudeSession) => {
    if (session.terminalId === null) return;
    void deps.bus.call(claudeLinkChannels.markSeen, { sessionId: session.sessionId });
    focusTerminal(session.terminalId);
  };

  return (
    <ul className={styles.rows}>
      {shown.map((session, index) => {
        const agents = listedAgents(session.subagents, now);
        const running = agents.filter((agent) => agent.endedAt === null).length;
        const percent = session.contextUsedPercentage;
        const cache = session.activity === 'done' || session.activity === 'idle' ? cacheState(session.lastResponseAt, now) : null;
        const tooltip = session.costUsd === null ? session.title : `${session.title} · $${session.costUsd.toFixed(2)}`;
        return (
          <li key={session.sessionId} style={staggerStyle(index)}>
            <Tooltip text={tooltip}>
              <button type="button" className={styles.sessionRow} onClick={() => activate(session)}>
                <span className={`${styles.activity} ${TONES[session.activity] ?? ''}`}>
                  <span
                    key={session.activity}
                    className={`${styles.dot} ${DOTS[session.activity] ?? ''} ${session.activity === 'needs-you' ? styles.pulse : ''}`}
                    aria-hidden="true"
                  />
                  {WORDS[session.activity]}
                </span>
                <span className={styles.title}>{session.title || 'Untitled session'}</span>
                <span className={styles.secondLine}>
                  <span className={styles.secondLeft}>{secondLeft(session, running)}</span>
                  {session.terminalId === null ? (
                    <span className={styles.muted}>outside HSOS</span>
                  ) : (
                    <span>
                      {session.model ?? ''}
                      {percent === null ? null : (
                        <span className={contextToneClass(percent)}> {Math.round(percent)}%</span>
                      )}
                    </span>
                  )}
                  {cache === null ? null : (
                    <Tooltip text="After this time the next message re-reads the whole conversation at full cost.">
                      <span className={cache === 'cold' ? styles.muted : styles.ok}>{cache}</span>
                    </Tooltip>
                  )}
                </span>
              </button>
            </Tooltip>
            {running === 0 && agents.length === 0 ? null : (
              <ul className={styles.agents} aria-label={`Subagents of ${session.title}`}>
                {agents.map((agent, agentIndex) => (
                  <li key={agent.agentId} className={styles.agentRow} style={staggerStyle(agentIndex)}>
                    <span>{agentIndex === agents.length - 1 ? '└' : '├'}</span>
                    <span>{agent.agentType}</span>
                    {agent.model === null ? null : <span className={styles.muted}>{agent.model}</span>}
                    <span className={styles.grow} />
                    <span className={agent.endedAt === null ? styles.ok : styles.muted}>
                      {agent.endedAt === null ? (agent.currentTool ?? '') : 'done'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
