/** Channels owned by the `skills` module. Spec: spec/modules/skills.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zEmpty, zEpochMs } from '../schemas';

/**
 * Claude Code's `skillOverrides` values (Claude Code 2.1.327). `name-only`: listed without its
 * description. `user-invocable-only`: hidden from the model, `/name` still works. `off`: hidden from both.
 */
export const SkillState = z.enum(['on', 'name-only', 'user-invocable-only', 'off']);
export type SkillState = z.infer<typeof SkillState>;

export const SkillInfo = z.object({
  /** The name typed after the slash, for example `caveman` or `mattpocock-skills:grilling`. */
  name: z.string(),
  description: z.string(),
  source: z.enum(['user', 'project', 'plugin']),
  /** Plugin name for plugin skills, else null. */
  plugin: z.string().nullable(),
  /** Path of the SKILL.md file. */
  file: zAbsPath,
  isFavourite: z.boolean(),
  /** What Claude Code does with the skill, from `skillOverrides` (SKILL-8). */
  state: SkillState,
  /** Which settings file sets `state`; `default` when none does. */
  stateSource: z.enum(['policy', 'local', 'project', 'user', 'default']),
  /** Why `state` cannot be changed from HSOS, or null (SKILL-9). */
  stateLock: z.enum(['policy', 'plugin', 'author']).nullable(),
});
export type SkillInfo = z.infer<typeof SkillInfo>;

export const SkillRun = z.object({
  id: z.string().length(12),
  skill: z.string(),
  args: z.string(),
  model: z.string(),
  effort: z.string().nullable(),
  cwd: zAbsPath,
  state: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  startedAt: zEpochMs.nullable(),
  endedAt: zEpochMs.nullable(),
  /** The run's final text, cut to 20 000 characters, or null while running. */
  report: z.string().nullable(),
  /** One sentence for a failed run. */
  failure: z.string().nullable(),
  costUsd: z.number().nonnegative().nullable(),
});
export type SkillRun = z.infer<typeof SkillRun>;

export const RepoSync = z.object({
  state: z.enum(['not-configured', 'idle', 'checking', 'syncing', 'in-sync', 'out-of-sync', 'error']),
  /** Skill folders whose files differ between this computer and the repo. */
  changed: z.array(z.string()),
  /** Skill folders only on this computer. */
  added: z.array(z.string()),
  /** Skill folders only in the repo. */
  removed: z.array(z.string()),
  /** Local commits not yet pushed. */
  ahead: z.number().int(),
  /** Remote commits not yet pulled. */
  behind: z.number().int(),
  isOffline: z.boolean(),
  error: z.string().nullable(),
  checkedAt: zEpochMs.nullable(),
});
export type RepoSync = z.infer<typeof RepoSync>;

export const SkillsSettings = z.object({
  /** Folder holding the owner's own skills. Empty means `%USERPROFILE%\.agents\skills`. */
  localSkillsDir: z.string().default(''),
  /** Clone of the skills repo. Empty means auto: the local folder itself when it is a repo, else `%USERPROFILE%\Documents\GitHub\SKILLS`. */
  repoDir: z.string().default(''),
  /** Model for background runs. */
  runModel: z.string().default('haiku'),
  /** Models offered in the run dialog. */
  runModels: z.array(z.string()).default(['haiku', 'sonnet', 'opus', 'fable']),
  /** Effort levels offered. An empty list hides the choice. */
  runEfforts: z.array(z.string()).default(['low', 'medium', 'high']),
  maxConcurrentRuns: z.number().int().min(1).max(4).default(1),
  /** Minutes after which a background run is stopped. */
  runTimeoutMinutes: z.number().int().min(1).max(120).default(20),
});
export type SkillsSettings = z.infer<typeof SkillsSettings>;

export const skillsSection: SettingsSection<SkillsSettings> = {
  moduleId: 'skills',
  title: 'Skills',
  schema: SkillsSettings,
  defaults: SkillsSettings.parse({}),
};

export const skillsChannels = {
  list: request('skills.list', 'workspace-service', zEmpty, z.array(SkillInfo)),
  listChanged: event('skills.listChanged', 'workspace-service', z.array(SkillInfo)),
  setFavourite: request(
    'skills.setFavourite',
    'workspace-service',
    z.object({ name: z.string(), isFavourite: z.boolean() }),
    zEmpty,
  ),
  /** Opens the owner's skills folder in Windows Explorer (SKILL-7). */
  openSkillsFolder: request('skills.openSkillsFolder', 'workspace-service', zEmpty, z.object({ path: zAbsPath })),
  /**
   * Changes one `skillOverrides` entry in one Claude Code settings file (SKILL-9). `scope` is used only
   * when no file sets the skill yet.
   */
  setState: request(
    'skills.setState',
    'workspace-service',
    z.object({ name: z.string().min(1).max(500), state: SkillState, scope: z.enum(['user', 'project-local']) }),
    z.object({ file: zAbsPath }),
    10_000,
  ),

  /** Starts a background run (SKILL-20). */
  startRun: request(
    'skills.startRun',
    'workspace-service',
    z.object({
      skill: z.string(),
      args: z.string().max(4000),
      model: z.string(),
      effort: z.string().nullable(),
      cwd: zAbsPath,
    }),
    SkillRun,
  ),
  cancelRun: request('skills.cancelRun', 'workspace-service', z.object({ id: z.string() }), zEmpty),
  listRuns: request('skills.listRuns', 'workspace-service', zEmpty, z.array(SkillRun)),
  runChanged: event('skills.runChanged', 'workspace-service', SkillRun),

  getRepoSync: request('skills.getRepoSync', 'workspace-service', zEmpty, RepoSync),
  /** Compares local skills with the repo (SKILL-30). */
  checkRepoSync: request('skills.checkRepoSync', 'workspace-service', zEmpty, RepoSync, 120_000),
  /** Copies local changes into the repo, commits and pushes (SKILL-32). */
  pushToRepo: request('skills.pushToRepo', 'workspace-service', zEmpty, RepoSync, 240_000),
  repoSyncChanged: event('skills.repoSyncChanged', 'workspace-service', RepoSync),
} as const;

/** The seam between background runs and the real claude executable. */
export type ClaudeRunner = {
  /** Starts `claude` with an argument array. Returns a handle to wait on or stop. */
  start(
    cwd: string,
    args: readonly string[],
  ): { done: Promise<{ exitCode: number; stdout: string; stderr: string }>; stop(): void };
};
