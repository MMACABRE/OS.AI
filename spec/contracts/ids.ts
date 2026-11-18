/**
 * Branded id types. A branded id cannot be passed where another id is expected.
 * Create ids only with the functions in this file.
 */

declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

/** First 16 hex chars of sha256(lower-cased absolute path with forward slashes). */
export type ProjectId = Brand<string, 'ProjectId'>;
/** Random id, 12 chars, created by pty-host. */
export type TerminalId = Brand<string, 'TerminalId'>;
/** Random id, 12 chars, created by the workspace when a panel opens. */
export type PanelId = Brand<string, 'PanelId'>;
/** The session_id Claude Code reports in hooks and statusline input. */
export type ClaudeSessionId = Brand<string, 'ClaudeSessionId'>;
/** The agent_id Claude Code reports for a subagent. */
export type AgentId = Brand<string, 'AgentId'>;
/** Random id, 12 chars, one per browser tab. */
export type BrowserTabId = Brand<string, 'BrowserTabId'>;
/** sha256 hex of file content. */
export type ContentHash = Brand<string, 'ContentHash'>;
/** Random id, 12 chars, one per snapshot row. */
export type SnapshotId = Brand<string, 'SnapshotId'>;
/** Random id, 12 chars, one per pinned comment. */
export type CommentId = Brand<string, 'CommentId'>;
/** Absolute Windows path, normalised: drive letter upper case, backslashes, no trailing slash. */
export type AbsPath = Brand<string, 'AbsPath'>;
/** Path relative to a project or vault root, forward slashes, no leading slash. */
export type RelPath = Brand<string, 'RelPath'>;
/** Milliseconds since the Unix epoch. */
export type EpochMs = Brand<number, 'EpochMs'>;

export type ModuleId =
  | 'diagnostics'
  | 'shell'
  | 'settings'
  | 'ui-kit'
  | 'workspace'
  | 'terminal'
  | 'files'
  | 'history'
  | 'git'
  | 'claude-link'
  | 'skills'
  | 'hud'
  | 'activity'
  | 'review'
  | 'browser'
  | 'graph'
  | 'cli'
  | 'sessions'
  | 'dashboard';

export type ServiceId = 'main' | 'pty-host' | 'workspace-service' | 'link-service';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Returns a 12-character random id. `random` is injected so tests are deterministic. */
export function newId<T extends string>(random: () => number = Math.random): T {
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += ID_ALPHABET.charAt(Math.floor(random() * ID_ALPHABET.length));
  }
  return out as T;
}

/** Normalises a Windows path to the AbsPath form. Does not touch the disk. */
export function toAbsPath(input: string): AbsPath {
  let path = input.replace(/\//g, '\\');
  if (path.length > 3 && path.endsWith('\\')) path = path.slice(0, -1);
  if (/^[a-z]:/.test(path)) path = path.charAt(0).toUpperCase() + path.slice(1);
  return path as AbsPath;
}

/** Normalises a relative path to the RelPath form. */
export function toRelPath(input: string): RelPath {
  return input.replace(/\\/g, '/').replace(/^\/+/, '') as RelPath;
}
