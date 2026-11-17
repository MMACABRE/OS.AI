/** Channels owned by the `git` module. Spec: spec/modules/git.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zEmpty, zEpochMs, zRelPath } from '../schemas';

export const ChangeCode = z.enum(['added', 'modified', 'deleted', 'renamed', 'copied', 'type-changed', 'unmodified']);
export type ChangeCode = z.infer<typeof ChangeCode>;

export const ChangedFile = z.object({
  path: zRelPath,
  originalPath: zRelPath.nullable(),
  staged: ChangeCode,
  unstaged: ChangeCode,
  isUntracked: z.boolean(),
  isConflicted: z.boolean(),
});
export type ChangedFile = z.infer<typeof ChangedFile>;

export const RepoStatus = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('git-missing') }),
  z.object({ kind: z.literal('not-a-repo'), root: zAbsPath }),
  z.object({
    kind: z.literal('repo'),
    root: zAbsPath,
    branch: z.string().nullable(),
    upstream: z.string().nullable(),
    ahead: z.number().int(),
    behind: z.number().int(),
    files: z.array(ChangedFile),
    /** A merge, rebase or cherry-pick is in progress. */
    operation: z.enum(['none', 'merge', 'rebase', 'cherry-pick']),
    /** Null when no fetch has succeeded in this run. */
    lastFetchAt: zEpochMs.nullable(),
    /** The last fetch failed because the network was unreachable. */
    isOffline: z.boolean(),
    /** Activity in progress, shown on the sync button. */
    busy: z.enum(['none', 'fetching', 'pulling', 'committing', 'pushing']),
  }),
]);
export type RepoStatus = z.infer<typeof RepoStatus>;

export const Worktree = z.object({
  path: zAbsPath,
  /** Folder name of the worktree; the main working tree is `main`. */
  name: z.string(),
  branch: z.string().nullable(),
  isMain: z.boolean(),
});
export type Worktree = z.infer<typeof Worktree>;

export const GitHubAccount = z.object({
  /** Whether the GitHub CLI is installed. */
  cliInstalled: z.boolean(),
  /** Login name when the CLI is logged in, else null. */
  login: z.string().nullable(),
});
export type GitHubAccount = z.infer<typeof GitHubAccount>;

export const GitSettings = z.object({
  /** Minutes between automatic fetches. 0 turns them off. */
  autoFetchMinutes: z.number().int().min(0).max(120).default(5),
  /** Pull automatically when the tree is clean and the branch is only behind. */
  autoPullFastForward: z.boolean().default(true),
  /** Repo roots where HSOS commits and pushes on its own after a quiet period (GIT-40). */
  autoSyncRepos: z.array(zAbsPath).default([]),
  autoSyncQuietMinutes: z.number().int().min(1).max(120).default(5),
  /** `summary` builds the message from file names. `claude` asks Claude Code, which spends usage. */
  messageGenerator: z.enum(['summary', 'claude']).default('summary'),
  /** Model used when `messageGenerator` is `claude`. */
  messageModel: z.string().default('haiku'),
  /** Parent folder for new worktrees, relative to the repo root's parent. */
  worktreeFolderSuffix: z.string().default('-worktrees'),
});
export type GitSettings = z.infer<typeof GitSettings>;

export const gitSection: SettingsSection<GitSettings> = {
  moduleId: 'git',
  title: 'Git and GitHub',
  schema: GitSettings,
  defaults: GitSettings.parse({}),
};

const zRoot = z.object({ root: zAbsPath });

export const gitChannels = {
  getStatus: request('git.getStatus', 'workspace-service', zRoot, RepoStatus),
  statusChanged: event('git.statusChanged', 'workspace-service', RepoStatus),
  /** Re-reads status now. */
  refresh: request('git.refresh', 'workspace-service', zRoot, RepoStatus, 30_000),

  fetch: request('git.fetch', 'workspace-service', zRoot, RepoStatus, 120_000),
  /** Fast-forward only. Returns GIT_DIRTY_TREE or GIT_CONFLICT when that is impossible (GIT-21). */
  pull: request('git.pull', 'workspace-service', zRoot, RepoStatus, 120_000),
  /** Stages `paths` (all changes when empty) and commits them. */
  commit: request(
    'git.commit',
    'workspace-service',
    z.object({ root: zAbsPath, message: z.string().min(1).max(10_000), paths: z.array(zRelPath) }),
    RepoStatus,
    60_000,
  ),
  push: request('git.push', 'workspace-service', zRoot, RepoStatus, 120_000),
  /** Pull if behind, then push if ahead (GIT-23). */
  sync: request('git.sync', 'workspace-service', zRoot, RepoStatus, 240_000),

  /** A commit message for the current changes (GIT-30). */
  suggestMessage: request('git.suggestMessage', 'workspace-service', zRoot, z.string(), 60_000),

  /** Text of a file at HEAD and in the working tree, for a diff. Either side is null when absent. */
  getFileDiff: request(
    'git.getFileDiff',
    'workspace-service',
    z.object({ root: zAbsPath, path: zRelPath }),
    z.object({ before: z.string().nullable(), after: z.string().nullable(), isBinary: z.boolean() }),
    30_000,
  ),

  listWorktrees: request('git.listWorktrees', 'workspace-service', zRoot, z.array(Worktree)),
  /** Creates a worktree on a new branch of the same name, from the current HEAD (GIT-50). */
  addWorktree: request(
    'git.addWorktree',
    'workspace-service',
    z.object({ root: zAbsPath, name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) }),
    Worktree,
    60_000,
  ),
  /** Removes a clean worktree. A worktree with changes returns GIT_DIRTY_TREE (GIT-52). */
  removeWorktree: request('git.removeWorktree', 'workspace-service', z.object({ root: zAbsPath, path: zAbsPath }), zEmpty, 60_000),

  getGitHubAccount: request('git.getGitHubAccount', 'workspace-service', zEmpty, GitHubAccount, 15_000),
} as const;

/** The seam between the git service and the real git.exe. Tests may run the real one in a temp repo. */
export type GitRunner = {
  /** Runs git with an argument array in `cwd`. Never goes through a shell (SEC-6). */
  run(
    cwd: string,
    args: readonly string[],
    options: { timeoutMs: number; stdin?: string },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};
