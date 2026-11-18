/** Channels owned by the `sessions` module. Spec: spec/modules/sessions.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zClaudeSessionId, zEpochMs, zTerminalId } from '../schemas';

/**
 * `running`: started and not ended. `ended`: the owner ended it (SESS-12).
 * `interrupted`: it stopped any other way, or HSOS lost its terminal (SESS-13).
 */
export const SessionState = z.enum(['running', 'ended', 'interrupted']);
export type SessionState = z.infer<typeof SessionState>;

/** What HSOS keeps on disk about one Claude session, one file per session (SESS-5). */
export const SessionRecord = z.object({
  version: z.literal(1),
  sessionId: zClaudeSessionId,
  cwd: zAbsPath,
  /** The HSOS terminal the session last ran in, or null when unknown. */
  terminalId: zTerminalId.nullable(),
  /** When `terminalId` was last set. The newest binding of a terminal wins (SESS-11). */
  boundAt: zEpochMs,
  transcriptPath: zAbsPath.nullable(),
  /** Latest `ai-title`, else the first prompt, cut to 80 characters; empty until known. */
  title: z.string().max(80),
  startedAt: zEpochMs,
  lastActiveAt: zEpochMs,
  state: SessionState,
  /** SessionEnd `reason`, `lost-terminal`, or null while running. */
  endReason: z.string().max(40).nullable(),
  /** Bytes of the transcript copied to the backup so far (SESS-20). */
  backupBytes: z.number().int().nonnegative(),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

/** One row of the session picker (SESS-30). */
export const SessionListItem = z.object({
  sessionId: zClaudeSessionId,
  title: z.string().max(80),
  cwd: zAbsPath,
  startedAt: zEpochMs.nullable(),
  lastActiveAt: zEpochMs,
  /** User prompts plus assistant replies in the transcript or backup. */
  messages: z.number().int().nonnegative(),
  /** `untracked`: found only in Claude Code's folder, never seen by HSOS. */
  state: z.enum(['running', 'ended', 'interrupted', 'untracked']),
  /** The terminal it is running in right now, when its shell is alive. */
  liveTerminalId: zTerminalId.nullable(),
  hasOriginal: z.boolean(),
  hasBackup: z.boolean(),
});
export type SessionListItem = z.infer<typeof SessionListItem>;

/** A session HSOS can bring back into a terminal (SESS-40). */
export const ResumeOffer = z.object({
  sessionId: zClaudeSessionId,
  title: z.string().max(80),
  cwd: zAbsPath,
  /** False when only the backup exists; resuming first restores it (SESS-22). */
  hasOriginal: z.boolean(),
});
export type ResumeOffer = z.infer<typeof ResumeOffer>;

/** One message of a transcript, for the reader (SESS-50). Text is data (P-6). */
export const TranscriptItem = z.object({
  index: z.number().int().nonnegative(),
  role: z.enum(['user', 'assistant', 'tool']),
  time: zEpochMs.nullable(),
  /** Markdown text for user and assistant items; the tool name for tool items. */
  text: z.string().max(100_000),
});
export type TranscriptItem = z.infer<typeof TranscriptItem>;

export const SessionsSettings = z.object({
  /** What a restored terminal does with an interrupted Claude session (SESS-41). */
  autoResume: z.enum(['always', 'ask', 'never']).default('always'),
  /** Keep HSOS's own copy of every transcript (SESS-20). */
  backupTranscripts: z.boolean().default(true),
});
export type SessionsSettings = z.infer<typeof SessionsSettings>;

export const sessionsSection: SettingsSection<SessionsSettings> = {
  moduleId: 'sessions',
  title: 'Claude sessions',
  schema: SessionsSettings,
  defaults: SessionsSettings.parse({}),
};

export const sessionsChannels = {
  /** Sessions whose `cwd` is the project folder or inside it, newest activity first, at most 500 (SESS-30). */
  list: request(
    'sessions.list',
    'link-service',
    z.object({ projectPath: zAbsPath, liveTerminalIds: z.array(zTerminalId) }),
    z.array(SessionListItem),
    15_000,
  ),
  /** The session to offer when a terminal that held `terminalId` comes back without its shell, or null (SESS-40). */
  getResumeOffer: request(
    'sessions.getResumeOffer',
    'link-service',
    z.object({ terminalId: zTerminalId }),
    ResumeOffer.nullable(),
  ),
  /** Records that a session now runs in `terminalId`. Written to disk before it returns (SESS-11). */
  bind: request(
    'sessions.bind',
    'link-service',
    z.object({ sessionId: zClaudeSessionId, terminalId: zTerminalId }),
    z.object({}),
  ),
  /** Copies the backup to Claude Code's transcript path when the original is missing (SESS-22). */
  restoreTranscript: request(
    'sessions.restoreTranscript',
    'link-service',
    z.object({ sessionId: zClaudeSessionId }),
    z.object({ path: zAbsPath }),
    30_000,
  ),
  /** Transcript items before `beforeIndex` (null for the end), oldest first, at most `limit` (SESS-50). */
  readTranscript: request(
    'sessions.readTranscript',
    'link-service',
    z.object({
      sessionId: zClaudeSessionId,
      beforeIndex: z.number().int().nonnegative().nullable(),
      limit: z.number().int().min(1).max(500),
    }),
    z.object({ items: z.array(TranscriptItem), total: z.number().int().nonnegative() }),
    15_000,
  ),
  recordChanged: event('sessions.recordChanged', 'link-service', SessionRecord),
} as const;

/** Text the terminal types to resume a session: through the HSOS `claude` wrapper, so hooks still load. */
export function resumeCommand(sessionId: string): string {
  return `claude --resume ${sessionId}`;
}
