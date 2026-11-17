/** Channels owned by the `claude-link` module. Spec: spec/modules/claude-link.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
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

  /** Connection details other local servers in link-service reuse (the MCP server). */
  getLocalEndpoint: request(
    'link.getLocalEndpoint',
    'link-service',
    zEmpty,
    z.object({ port: z.number().int(), pluginDir: zAbsPath, sessionSettingsFile: zAbsPath }),
  ),
} as const;
