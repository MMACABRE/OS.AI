/**
 * Result and error types used by every module. See spec/02-architecture.md §3.
 * Expected failures are returned, never thrown.
 */

export const ERROR_CODES = [
  // bus
  'BAD_REQUEST',
  'INTERNAL',
  'TIMEOUT',
  'SERVICE_DOWN',
  'NOT_FOUND',
  'CANCELLED',
  // settings
  'SET_INVALID',
  'SET_VERSION_TOO_NEW',
  // workspace
  'WS_PROJECT_MISSING',
  'WS_LAYOUT_INVALID',
  // terminal
  'TERM_SPAWN_FAILED',
  'TERM_NOT_RUNNING',
  // files
  'FILE_NOT_FOUND',
  'FILE_TOO_LARGE',
  'FILE_BINARY',
  'FILE_CHANGED_ON_DISK',
  'FILE_OUTSIDE_ROOT',
  'FILE_WRITE_FAILED',
  'FILE_EXISTS',
  // history
  'HIST_OBJECT_MISSING',
  // git
  'GIT_NOT_INSTALLED',
  'GIT_NOT_A_REPO',
  'GIT_DIRTY_TREE',
  'GIT_CONFLICT',
  'GIT_AUTH_REQUIRED',
  'GIT_OFFLINE',
  'GIT_COMMAND_FAILED',
  'GIT_REFUSED_UNSAFE',
  // claude-link
  'LINK_NOT_INSTALLED',
  'LINK_SETTINGS_WRITE_FAILED',
  // skills
  'SKILL_NOT_FOUND',
  'SKILL_RUN_FAILED',
  // browser
  'BROW_TAB_NOT_FOUND',
  'BROW_NAVIGATION_BLOCKED',
  'BROW_ELEMENT_NOT_FOUND',
  'BROW_CONTROL_STOPPED',
  // graph
  'GRAPH_INDEX_BUSY',
  // cli
  'CLI_UNAUTHORISED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppError = {
  readonly code: ErrorCode;
  /** One plain sentence for the owner: what failed and what to do. */
  readonly message: string;
  readonly details?: unknown;
};

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly error: AppError };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string, details?: unknown): Err {
  return details === undefined
    ? { ok: false, error: { code, message } }
    : { ok: false, error: { code, message, details } };
}
