import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { ClaudeSession, SubagentInfo } from '@hsos/contracts/channels/claude-link';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { TerminalId } from '@hsos/contracts/ids';
import {
  ProgressBar,
  RollingNumber,
  staggerStyle,
  Surface,
  Tooltip,
  useBackdropSource,
} from '@hsos/ui-kit';
import { Mascot } from '../mascot/Mascot';
import { sessionForTerminal, useHudData } from '../hud-data';
import styles from './Ribbon.module.css';

/** Subagents that ended stay listed this long with "done" (HUD-82, LINK-29). */
export const ENDED_AGENT_MS = 60_000;
/** At most this many mini mascots; more show as `+<n>` (HUD-92). */
export const MAX_MINI_MASCOTS = 5;

export type RibbonDeps = {
  readonly bus: Bus;
  readonly openPanel: (type: string) => void;
};

const MODE_LABELS: Readonly<Record<string, string>> = {
  default: 'Default',
  acceptEdits: 'Accept edits',
  plan: 'Plan',
  auto: 'Auto',
  dontAsk: "Don't ask",
  bypassPermissions: 'Bypass',
};

const ACTIVITY_WORDS: Readonly<Record<ClaudeSession['activity'], string>> = {
  'needs-you': 'needs you',
  working: 'working',
  background: 'background',
  done: 'done',
  idle: 'idle',
  ended: 'ended',
};

/** `C:\Users\name\code\x` becomes `~\code\x`; long paths are cut in the middle (HUD-81). */
export function shortFolder(cwd: string, max = 32): string {
  const home = /^[A-Za-z]:\\Users\\[^\\]+/.exec(cwd);
  const path = home === null ? cwd : `~${cwd.slice(home[0].length)}`;
  if (path.length <= max) return path;
  const keep = max - 1;
  return `${path.slice(0, Math.ceil(keep / 2))}…${path.slice(path.length - Math.floor(keep / 2))}`;
}

/** HUD-9: context is toned warn from 70 and danger from 90. */
const contextTone = (percent: number) => (percent >= 90 ? 'danger' : percent >= 70 ? 'warn' : 'ok');

/** Time since `from`: `42s`, `12m`, `3h 05m`. */
export function elapsedSince(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** The subagents the ribbon lists: running ones and those that ended in the last 60 s (HUD-82). */
export function listedAgents(agents: readonly SubagentInfo[], now: number): SubagentInfo[] {
  return agents.filter((agent) => agent.endedAt === null || now - agent.endedAt < ENDED_AGENT_MS);
}

/**
 * The session ribbon above a Claude terminal (HUD-80 to HUD-83): the mascot, chat name, model and
 * effort, mode, folder, repo, context and agents, kept in view while the chat scrolls. Expanded, it lists
 * each subagent. It is a steam source in `color.live`, or `color.brand` while the session needs the owner.
 */
export function createRibbon(deps: RibbonDeps) {
  return function RibbonFor({ terminalId }: { readonly terminalId: TerminalId }) {
    const session = useHudData((state) => sessionForTerminal(state.sessions, terminalId));
    if (session === null) return null;
    return <Ribbon session={session} terminalId={terminalId} deps={deps} />;
  };
}

function Ribbon({
  session,
  terminalId,
  deps,
}: {
  readonly session: ClaudeSession;
  readonly terminalId: TerminalId;
  readonly deps: RibbonDeps;
}) {
  const { bus } = deps;
  const repo = useHudData((state) => state.repo);
  const project = useHudData((state) => state.project);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const root = useRef<HTMLDivElement>(null);
  const needsYou = session.activity === 'needs-you';
  useBackdropSource(root, needsYou ? 'color.brand' : 'color.live', needsYou ? 0.8 : 0.5);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const agents = listedAgents(session.subagents, now);
  const running = agents.filter((agent) => agent.endedAt === null);
  const mode = session.permissionMode;
  const showRepo =
    repo !== null &&
    repo.kind === 'repo' &&
    repo.webUrl !== null &&
    project !== null &&
    session.cwd.toLowerCase().startsWith(project.path.toLowerCase());
  const repoName = showRepo && repo.kind === 'repo' && repo.webUrl !== null ? new URL(repo.webUrl).pathname.slice(1) : null;
  const percent = session.contextUsedPercentage;
  const word = ACTIVITY_WORDS[session.activity];

  const cycleMode = () => {
    if (session.activity === 'needs-you' || session.activity === 'ended') return;
    void bus.call(terminalChannels.write, { id: terminalId, data: '\u001b[Z', source: 'quick-command' });
  };

  return (
    <div ref={root} className={styles.ribbon} data-activity={session.activity} data-expanded={expanded}>
      <Surface role="ribbon">
        <div className={styles.line}>
          <button
            type="button"
            className={styles.mascotButton}
            aria-label={expanded ? 'Collapse the ribbon' : 'Expand the ribbon'}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            <Mascot activity={session.activity} page="code" scale={2} />
          </button>
          {running.slice(0, MAX_MINI_MASCOTS).map((agent) => (
            <Mascot key={agent.agentId} activity="working" page="other" scale={1} state="dancing" />
          ))}
          {running.length > MAX_MINI_MASCOTS ? (
            <span className={styles.more}>+{running.length - MAX_MINI_MASCOTS}</span>
          ) : null}
          <Tooltip text={`${session.title || 'Untitled session'} · ${word}`}>
            <button type="button" className={styles.chat} onClick={() => deps.openPanel('sessions.history')}>
              {session.title || 'Untitled session'}
            </button>
          </Tooltip>
          {session.model === null ? null : (
            <span className={styles.model}>
              {session.model}
              {session.effort === null ? null : <span className={styles.effort}> · {session.effort}</span>}
            </span>
          )}
          {mode === null || mode === 'default' ? null : (
            <Tooltip text="As Claude last reported it">
              <button type="button" className={`${styles.mode} ${styles.dropMode}`} onClick={cycleMode} tabIndex={-1}>
                {MODE_LABELS[mode] ?? mode}
              </button>
            </Tooltip>
          )}
          <button
            type="button"
            className={`${styles.folder} ${styles.dropFolder}`}
            title={session.cwd}
            onClick={() => deps.openPanel('files.view')}
          >
            {shortFolder(session.cwd)}
          </button>
          {repoName === null || repo === null || repo.kind !== 'repo' || repo.webUrl === null ? null : (
            <button
              type="button"
              className={`${styles.repo} ${styles.dropRepo}`}
              onClick={() => {
                if (repo.webUrl !== null) void bus.call(shellChannels.openExternal, { url: repo.webUrl });
              }}
            >
              {repoName}
              {repo.branch === null ? null : <span className={styles.branch}> {repo.branch}</span>}
            </button>
          )}
          <span className={styles.grow} />
          {percent === null ? null : (
            <span className={styles.context}>
              <span className={styles.contextBar}>
                <ProgressBar value={percent / 100} tone={contextTone(percent)} label={`Context ${Math.round(percent)} percent`} />
              </span>
              <span className={styles[contextTone(percent)]}>
                <RollingNumber value={Math.round(percent)} format={(value) => `${value}%`} />
              </span>
            </span>
          )}
          {running.length === 0 ? null : (
            <button type="button" className={styles.agents} onClick={() => setExpanded(true)}>
              {running.length} {running.length === 1 ? 'agent' : 'agents'}
            </button>
          )}
        </div>
        {expanded ? (
          <ul className={styles.rows} aria-label="Subagents">
            {agents.length === 0 ? <li className={styles.none}>No subagents running.</li> : null}
            {agents.map((agent, index) => (
              <li key={agent.agentId} className={styles.row} style={staggerStyle(index)}>
                <Mascot
                  activity={agent.endedAt === null ? 'working' : 'idle'}
                  page="other"
                  scale={1}
                  state={agent.endedAt === null ? 'dancing' : 'resting'}
                />
                <span className={styles.agentType}>{agent.agentType}</span>
                {agent.model === null ? null : <span className={styles.model}>{agent.model}</span>}
                <span className={styles.description}>{agent.description ?? ''}</span>
                <span className={styles.tool}>{agent.endedAt === null ? (agent.currentTool ?? '') : 'done'}</span>
                <span className={styles.elapsed}>{elapsedSince(agent.startedAt, agent.endedAt ?? now)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Surface>
    </div>
  );
}
