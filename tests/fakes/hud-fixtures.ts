import { vi } from 'vitest';
import type { Bus } from '@hsos/contracts/bus';
import { ClaudeSession, ClaudeSetup } from '@hsos/contracts/channels/claude-link';
import type { SubagentInfo } from '@hsos/contracts/channels/claude-link';
import { RepoSync, SkillInfo } from '@hsos/contracts/channels/skills';
import type { EpochMs } from '@hsos/contracts/ids';
import { zEpochMs, zTerminalId } from '@hsos/contracts/schemas';
import type { HudDeps } from '../../src/modules/hud/panel/hud-context';
import { useHudData } from '../../src/modules/hud/panel/hud-data';
import { PROJECT } from './fixtures';

export const T1 = zTerminalId.parse('terminal-t1_');
export const T2 = zTerminalId.parse('terminal-t2_');

type Millis = { readonly [K in 'startedAt' | 'lastResponseAt']?: number | null };

type SessionInput = Partial<
  Omit<ClaudeSession, 'sessionId' | 'terminalId' | 'subagents' | 'startedAt' | 'lastResponseAt' | 'cwd'>
> &
  Millis & {
    readonly sessionId?: string;
    readonly cwd?: string;
    readonly terminalId?: string | null;
    readonly subagents?: readonly (Partial<Omit<SubagentInfo, 'startedAt' | 'endedAt'>> & {
      readonly startedAt?: number;
      readonly endedAt?: number | null;
    })[];
  };

/** A millisecond timestamp in the EpochMs form. */
export const ms = (value: number): EpochMs => zEpochMs.parse(value);

/** A ClaudeSession built through the contract schema, an idle session in the project folder by default. */
export function session(id: string, input: SessionInput = {}): ClaudeSession {
  const { subagents = [], ...rest } = input;
  return ClaudeSession.parse({
    sessionId: id,
    terminalId: T1,
    cwd: PROJECT.path,
    title: id,
    model: 'Opus 5.5',
    modelId: 'claude-opus-5-5',
    effort: null,
    permissionMode: 'default',
    activity: 'idle',
    attentionReason: null,
    currentTool: null,
    startedAt: 1_000,
    lastResponseAt: null,
    contextUsedPercentage: null,
    contextTokens: null,
    contextWindowSize: null,
    costUsd: null,
    lastMessage: null,
    ...rest,
    subagents: subagents.map((agent, index) => ({
      agentId: `agent-${index}`,
      agentType: 'Explore',
      model: null,
      description: null,
      startedAt: 1_000,
      endedAt: null,
      currentTool: null,
      ...agent,
    })),
  });
}

export function skill(name: string, input: Partial<SkillInfo> = {}): SkillInfo {
  return SkillInfo.parse({
    name,
    description: `Description of ${name}`,
    source: 'user',
    plugin: null,
    file: `C:\\skills\\${name}\\SKILL.md`,
    isFavourite: false,
    state: 'on',
    stateSource: 'default',
    stateLock: null,
    ...input,
  });
}

export function repoSync(input: Partial<RepoSync> = {}): RepoSync {
  return RepoSync.parse({
    state: 'in-sync',
    changed: [],
    added: [],
    removed: [],
    ahead: 0,
    behind: 0,
    isOffline: false,
    error: null,
    checkedAt: null,
    ...input,
  });
}

/** A ClaudeSetup with empty lists; override what a test needs. */
export function setupOf(input: Record<string, unknown> = {}): ClaudeSetup {
  return ClaudeSetup.parse({
    mcpServers: [],
    plugins: [],
    skillUse: {},
    agents: [],
    hooks: [],
    permissions: [],
    errors: [],
    readAt: 0,
    ...input,
  });
}

/** Puts the HUD store back to its first state, then applies `values` (sessions as a list). */
export function seedHud(values: {
  readonly sessions?: readonly ClaudeSession[];
  readonly focusOrder?: readonly (typeof T1)[];
  readonly project?: boolean;
  readonly [key: string]: unknown;
}): void {
  const { sessions = [], focusOrder = [], project = true, ...rest } = values;
  useHudData.setState(useHudData.getInitialState(), true);
  useHudData.setState({
    sessions: new Map(sessions.map((entry) => [entry.sessionId, entry])),
    sessionsLoaded: { kind: 'ready', value: true },
    focusOrder,
    project: project ? PROJECT : null,
    ...rest,
  });
}

export function makeDeps(bus: Bus, input: Partial<HudDeps> = {}): HudDeps {
  return {
    bus,
    log: { log: vi.fn() },
    openPanel: vi.fn(),
    setSetting: vi.fn(() => Promise.resolve(true)),
    hasCommand: () => false,
    runCommand: vi.fn(),
    ...input,
  };
}
