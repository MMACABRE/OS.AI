/** Channels owned by the `history` module. Spec: spec/modules/history.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { FileVersion } from './files';
import { zAbsPath, zContentHash, zEmpty, zEpochMs, zProjectId, zSnapshotId } from '../schemas';

export const SnapshotSource = z.enum([
  /** Content before the first change HSOS observed. */
  'baseline',
  /** Saved from the HSOS editor. */
  'hsos-save',
  /** Changed by something else: Claude, another program, git. */
  'external',
  /** Written by a restore from history. */
  'restore',
  /** The file was deleted; this is its last content. */
  'deleted',
]);
export type SnapshotSource = z.infer<typeof SnapshotSource>;

export const Snapshot = z.object({
  id: zSnapshotId,
  path: zAbsPath,
  hash: zContentHash,
  time: zEpochMs,
  size: z.number().int().nonnegative(),
  source: SnapshotSource,
});
export type Snapshot = z.infer<typeof Snapshot>;

export const HistorySettings = z.object({
  enabled: z.boolean().default(true),
  /** Files larger than this are not snapshotted. */
  maxFileBytes: z.number().int().min(1024).max(100_000_000).default(2_000_000),
  maxAgeDays: z.number().int().min(1).max(365).default(30),
  maxSnapshotsPerFile: z.number().int().min(5).max(5000).default(200),
  maxTotalBytes: z.number().int().min(10_000_000).max(50_000_000_000).default(2_000_000_000),
  /** Glob patterns never snapshotted. */
  exclude: z
    .array(z.string())
    .default(['**/.git/**', '**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/target/**']),
});
export type HistorySettings = z.infer<typeof HistorySettings>;

export const historySection: SettingsSection<HistorySettings> = {
  moduleId: 'history',
  title: 'Local history',
  schema: HistorySettings,
  defaults: HistorySettings.parse({}),
};

export const historyChannels = {
  /** Snapshots of one file, newest first. */
  listForFile: request('history.listForFile', 'workspace-service', z.object({ path: zAbsPath }), z.array(Snapshot)),
  /** Snapshots across the project, newest first, older than `before` when given. */
  listRecent: request(
    'history.listRecent',
    'workspace-service',
    z.object({ projectId: zProjectId, limit: z.number().int().min(1).max(500), before: zEpochMs.nullable() }),
    z.array(Snapshot),
  ),
  /** Text of a snapshot. Returns FILE_BINARY for content that is not text. */
  readText: request('history.readText', 'workspace-service', z.object({ id: zSnapshotId }), z.string()),
  /** The snapshot just before `id` for the same file, or null. Used to build a diff. */
  getPrevious: request(
    'history.getPrevious',
    'workspace-service',
    z.object({ id: zSnapshotId }),
    Snapshot.nullable(),
  ),
  /** Writes a snapshot's content back to its path (HIST-20). */
  restore: request('history.restore', 'workspace-service', z.object({ id: zSnapshotId }), FileVersion, 30_000),
  /** Recreates a deleted file from its `deleted` snapshot. */
  restoreDeleted: request(
    'history.restoreDeleted',
    'workspace-service',
    z.object({ id: zSnapshotId }),
    FileVersion,
    30_000,
  ),

  /**
   * Snapshots a file's current content now, if history does not already hold it.
   * Used by claude-link just before Claude edits a file (LINK-30). Returns null when
   * the file is missing, excluded or too large.
   */
  snapshotNow: request(
    'history.snapshotNow',
    'workspace-service',
    z.object({ path: zAbsPath, source: SnapshotSource }),
    Snapshot.nullable(),
    1_500,
  ),

  snapshotAdded: event('history.snapshotAdded', 'workspace-service', Snapshot),

  getUsage: request(
    'history.getUsage',
    'workspace-service',
    z.object({ projectId: zProjectId }),
    z.object({ snapshots: z.number().int(), bytes: z.number().int() }),
  ),
  /** Runs retention now (HIST-30). */
  prune: request('history.prune', 'workspace-service', z.object({ projectId: zProjectId }), zEmpty, 120_000),
} as const;

/**
 * `history` observes writes made by `files` by contributing a FileWriteObserver
 * to the `fileWriteObservers` extension point declared in channels/files.ts.
 * `files` never imports this file.
 */
