/** Channels owned by the `claude-link` module. Spec: spec/modules/claude-link.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { TerminalId } from '../ids';
import type { ExtensionPoint, SettingsSection } from '../module';
import { zAbsPath, zAgentId, zClaudeSessionId, zEmpty, zEpochMs, zTerminalId } from '../schemas';

/** What a session is doing, as the attention board shows it (LINK-20). */
export const SessionActivity = z.enum([
  /** Claude is producing a response or running tools. */
  'working',
  /** The turn ended but background tasks are still running. */
  'background',
  /** Claude is blocked until the owner acts. */
  'needs-you',
  /** The turn ended and the owner has not looked at it yet. */
  'done',
  /** The turn ended and the owner has seen it. */
  'idle',
  /** The session has exited. */
  'ended',
]);
export type SessionActivity = z.infer<typeof SessionActivity>;

export const SubagentInfo = z.object({
  agentId: zAgentId,
  /** For example `Explore` or `general-purpose`. */
  agentType: z.string(),
  /** Model named when the agent was spawned, or null when it inherits the session's model. */
  model: z.string().nullable(),
  /** The short description given when the agent was spawned, or null. */
  description: z.string().nullable(),
  startedAt: zEpochMs,
  /** Null while running. */
  endedAt: zEpochMs.nullable(),
  /** Name of the tool the agent is running now, or null. */
  currentTool: z.string().nullable(),
});
export type SubagentInfo = z.infer<typeof SubagentInfo>;

export const UsageWindow = z.object({
  /** 0 to 100. */
  usedPercentage: z.number().min(0).max(100),
  resetsAt: zEpochMs,
});
export type UsageWindow = z.infer<typeof UsageWindow>;

/** Account-wide limits, from the newest statusline input of any session (LINK-41). */
export const UsageLimits = z.object({
  fiveHour: UsageWindow.nullable(),
  sevenDay: UsageWindow.nullable(),
  /** When these numbers were received. Null means no session has reported yet. */
  updatedAt: zEpochMs.nullable(),
});
export type UsageLimits = z.infer<typeof UsageLimits>;

export const ClaudeSession = z.object({
  sessionId: zClaudeSessionId,
  /** The HSOS terminal the session runs in, or null for a session started outside HSOS. */
  terminalId: zTerminalId.nullable(),
  cwd: zAbsPath,
  /** Session name or first prompt, cut to 80 characters. */
  title: z.string(),
  model: z.string().nullable(),
  effort: z.string().nullable(),
  activity: SessionActivity,
  /** Why the session needs the owner, for example `Permission: Bash`. Null otherwise. */
  attentionReason: z.string().nullable(),
  /** Name of the tool the main agent is running now, or null. */
  currentTool: z.string().nullable(),
  startedAt: zEpochMs,
  /** Time of the last event that shows Claude responded. Drives the cache state (LINK-50). */
  lastResponseAt: zEpochMs.nullable(),
  /** 0 to 100, or null before the first statusline input. */
  contextUsedPercentage: z.number().min(0).max(100).nullable(),
  /** Estimated cost in US dollars, or null. */
  costUsd: z.number().nonnegative().nullable(),
  /** The last assistant message, cut to 500 characters, or null. */
  lastMessage: z.string().nullable(),
  subagents: z.array(SubagentInfo),
});
export type ClaudeSession = z.infer<typeof ClaudeSession>;

/** One thing a session did, kept for the recap and the activity timeline (LINK-60). */
export const SessionEvent = z.object({
  sessionId: zClaudeSessionId,
  agentId: zAgentId.nullable(),
  time: zEpochMs,
  kind: z.enum(['prompt', 'tool', 'tool-failed', 'file-edit', 'subagent-start', 'subagent-stop', 'stop', 'attention']),
  /** Tool name, or a short label for other kinds. */
  label: z.string().max(120),
  /** File touched by an edit tool, when known. */
  path: zAbsPath.nullable(),
});
export type SessionEvent = z.infer<typeof SessionEvent>;

export const LinkStatus = z.object({
  /** Whether the hook receiver is listening. */
  isListening: z.boolean(),
  port: z.number().int().nullable(),
  /** Whether Claude Code was found on PATH. */
  claudeFound: z.boolean(),
  claudeVersion: z.string().nullable(),
  /** Time of the last hook or statusline message received, or null. */
  lastMessageAt: zEpochMs.nullable(),
});
export type LinkStatus = z.infer<typeof LinkStatus>;

/** Where a piece of Claude Code setup is configured (LINK-70). */
export const SetupScope = z.enum(['user', 'project', 'local', 'plugin']);
export type SetupScope = z.infer<typeof SetupScope>;

/** When something was last used, and who counted it. */
export const LastUse = z.object({
  at: zEpochMs.nullable(),
  /** Number of uses when the source counts them, else null. */
  count: z.number().int().nonnegative().nullable(),
  /** `claude`: Claude Code's own counters in ~/.claude.json. `hsos`: HSOS hooks, sessions in HSOS terminals only. */
  source: z.enum(['claude', 'hsos']),
});
export type LastUse = z.infer<typeof LastUse>;

/** Read-only inventory of the owner's Claude Code setup (LINK-70 to LINK-74). Never holds secrets (LINK-71). */
export const ClaudeSetup = z.object({
  mcpServers: z.array(
    z.object({
      name: z.string(),
      scope: SetupScope,
      transport: z.enum(['stdio', 'http', 'sse', 'unknown']),
      /** stdio: the command's file name, such as `npx.cmd`. http and sse: the URL's host. Never arguments, paths after the host, headers or env. */
      target: z.string(),
      /** False when the project's `disabledMcpjsonServers` names it; null when Claude Code decides at start. */
      enabled: z.boolean().nullable(),
      file: zAbsPath,
      lastUse: LastUse.nullable(),
    }),
  ),
  plugins: z.array(
    z.object({
      /** `<name>@<marketplace>`. */
      id: z.string(),
      version: z.string().nullable(),
      scope: z.string(),
      enabled: z.boolean(),
      installedAt: zEpochMs.nullable(),
      file: zAbsPath,
      lastUse: LastUse.nullable(),
    }),
  ),
  /** Skill usage from Claude Code's counters, keyed by skill name. Skills themselves come from `skills.list`. */
  skillUse: z.record(z.string(), LastUse),
  agents: z.array(
    z.object({ name: z.string(), scope: SetupScope, file: zAbsPath, lastUse: LastUse.nullable() }),
  ),
  hooks: z.array(
    z.object({ event: z.string(), handlers: z.number().int().positive(), scope: SetupScope, file: zAbsPath }),
  ),
  permissions: z.array(
    z.object({ rule: z.string().max(500), effect: z.enum(['allow', 'ask', 'deny']), scope: SetupScope, file: zAbsPath }),
  ),
  /** Files that could not be read or parsed. The other sources are still returned. */
  errors: z.array(z.object({ file: zAbsPath, message: z.string().max(300) })),
  readAt: zEpochMs,
});
export type ClaudeSetup = z.infer<typeof ClaudeSetup>;

/**
 * Other modules in link-service see every accepted hook by contributing one of these (LINK-15).
 * `payload` is the parsed JSON body, untrusted: observers validate what they read.
 */
export type HookObserver = {
  onHook(event: string, terminalId: TerminalId | null, payload: unknown): void;
};

export const hookObservers: ExtensionPoint<HookObserver> = { id: 'claude-link.hookObservers' };

export const ClaudeLinkSettings = z.object({
  enabled: z.boolean().default(true),
  /** First port tried by the receiver. The next 20 are tried when it is taken. */
  port: z.number().int().min(1024).max(65_000).default(47_600),
  /** Minutes of idleness after which a session's prompt cache is treated as cold. */
  cacheWarmMinutes: z.number().int().min(1).max(240).default(60),
  /** Snapshot a file just before Claude edits it. */
  snapshotBeforeEdit: z.boolean().default(true),
  /** How many ended sessions stay listed. */
  keepEndedSessions: z.number().int().min(0).max(100).default(10),
});
export type ClaudeLinkSettings = z.infer<typeof ClaudeLinkSettings>;

export const claudeLinkSection: SettingsSection<ClaudeLinkSettings> = {
  moduleId: 'claude-link',
  title: 'Claude Code link',
  schema: ClaudeLinkSettings,
  defaults: ClaudeLinkSettings.parse({}),
};

export const claudeLinkChannels = {
  getStatus: request('link.getStatus', 'link-service', zEmpty, LinkStatus),
  statusChanged: event('link.statusChanged', 'link-service', LinkStatus),

  listSessions: request('link.listSessions', 'link-service', zEmpty, z.array(ClaudeSession)),
  /** Emitted whenever any field of a session changes. At most 10 times a second per session. */
  sessionChanged: event('link.sessionChanged', 'link-service', ClaudeSession),
  sessionRemoved: event('link.sessionRemoved', 'link-service', z.object({ sessionId: zClaudeSessionId })),

  getUsageLimits: request('link.getUsageLimits', 'link-service', zEmpty, UsageLimits),
  usageLimitsChanged: event('link.usageLimitsChanged', 'link-service', UsageLimits),

  /** The owner looked at a session's terminal: `done` becomes `idle` (LINK-24). */
  markSeen: request('link.markSeen', 'link-service', z.object({ sessionId: zClaudeSessionId }), zEmpty),

  /** Events of one session since `since`, oldest first, at most 500. */
  getSessionEvents: request(
    'link.getSessionEvents',
    'link-service',
    z.object({ sessionId: zClaudeSessionId, since: zEpochMs.nullable() }),
    z.array(SessionEvent),
  ),
  sessionEvent: event('link.sessionEvent', 'link-service', SessionEvent),

  /** Reads the owner's Claude Code setup for a project folder (LINK-70). Read-only. */
  getSetup: request('link.getSetup', 'link-service', z.object({ projectPath: zAbsPath }), ClaudeSetup, 10_000),

  /** Connection details other local servers in link-service reuse (the MCP server). */
  getLocalEndpoint: request(
    'link.getLocalEndpoint',
    'link-service',
    zEmpty,
    z.object({ port: z.number().int(), pluginDir: zAbsPath, sessionSettingsFile: zAbsPath }),
  ),
} as const;
