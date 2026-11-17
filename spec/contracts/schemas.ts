/**
 * Zod schemas for the branded types in ids.ts, shared by every channel file.
 * A branded schema checks the string shape only; the brand exists at compile time.
 */
import { z } from 'zod';
import type {
  AbsPath,
  AgentId,
  BrowserTabId,
  ClaudeSessionId,
  CommentId,
  ContentHash,
  EpochMs,
  PanelId,
  ProjectId,
  RelPath,
  SnapshotId,
  TerminalId,
} from './ids';
import { ERROR_CODES } from './result';

function brandedString<T extends string>(schema: z.ZodString): z.ZodType<T> {
  return schema as unknown as z.ZodType<T>;
}

export const zAbsPath = brandedString<AbsPath>(z.string().min(3).max(32_000));
export const zRelPath = brandedString<RelPath>(z.string().max(32_000));
export const zProjectId = brandedString<ProjectId>(z.string().regex(/^[0-9a-f]{16}$/));
export const zTerminalId = brandedString<TerminalId>(z.string().length(12));
export const zPanelId = brandedString<PanelId>(z.string().length(12));
export const zBrowserTabId = brandedString<BrowserTabId>(z.string().length(12));
export const zSnapshotId = brandedString<SnapshotId>(z.string().length(12));
export const zCommentId = brandedString<CommentId>(z.string().length(12));
export const zClaudeSessionId = brandedString<ClaudeSessionId>(z.string().min(1).max(200));
export const zAgentId = brandedString<AgentId>(z.string().min(1).max(200));
export const zContentHash = brandedString<ContentHash>(z.string().regex(/^[0-9a-f]{64}$/));
export const zEpochMs = z.number().int().nonnegative() as unknown as z.ZodType<EpochMs>;

export const zServiceId = z.enum(['main', 'pty-host', 'workspace-service', 'link-service']);

export const zModuleId = z.enum([
  'diagnostics',
  'shell',
  'settings',
  'ui-kit',
  'workspace',
  'terminal',
  'files',
  'history',
  'git',
  'claude-link',
  'skills',
  'hud',
  'activity',
  'review',
  'browser',
  'graph',
  'mcp',
]);

export const zAppError = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

/** Use for requests that carry nothing and responses that return nothing. */
export const zEmpty = z.object({});
export type Empty = z.infer<typeof zEmpty>;
