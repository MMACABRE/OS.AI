/** Channels owned by the `activity` module. Spec: spec/modules/activity.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zClaudeSessionId, zEmpty, zEpochMs, zProjectId, zRelPath, zSnapshotId } from '../schemas';

export const ActivityCause = z.enum([
  /** Saved or restored by the owner in HSOS. */
  'owner',
  /** Written by a Claude session's edit tool. */
  'claude',
  /** Changed by something else. */
  'outside',
]);
export type ActivityCause = z.infer<typeof ActivityCause>;

export const ActivityEntry = z.object({
  snapshotId: zSnapshotId,
  path: zAbsPath,
  relPath: zRelPath,
  time: zEpochMs,
  change: z.enum(['created', 'changed', 'deleted', 'restored']),
  cause: ActivityCause,
  /** Set when `cause` is `claude`. */
  sessionId: zClaudeSessionId.nullable(),
  /** Session title at the time, for display. */
  sessionTitle: z.string().nullable(),
  /** Lines added and removed against the previous version. Null for binary content. */
  linesAdded: z.number().int().nullable(),
  linesRemoved: z.number().int().nullable(),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

export const Artifact = z.object({
  path: zAbsPath,
  relPath: zRelPath,
  kind: z.enum(['html', 'pdf', 'image', 'video']),
  size: z.number().int().nonnegative(),
  modifiedAt: zEpochMs,
  /** Session that produced it, when known. */
  sessionId: zClaudeSessionId.nullable(),
  sessionTitle: z.string().nullable(),
  /** True when the owner added it by hand. */
  isPinned: z.boolean(),
});
export type Artifact = z.infer<typeof Artifact>;

export const ActivitySettings = z.object({
  /** File extensions treated as artifacts, without the dot. */
  artifactExtensions: z
    .array(z.string())
    .default(['html', 'htm', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'webm']),
  /** Folder names whose files are never artifacts. */
  artifactExcludeFolders: z
    .array(z.string())
    .default(['node_modules', 'dist', 'build', 'out', '.next', 'public', 'assets', 'static', 'coverage']),
  maxArtifacts: z.number().int().min(10).max(5000).default(500),
});
export type ActivitySettings = z.infer<typeof ActivitySettings>;

export const activitySection: SettingsSection<ActivitySettings> = {
  moduleId: 'activity',
  title: 'Activity and artifacts',
  schema: ActivitySettings,
  defaults: ActivitySettings.parse({}),
};

export const activityChannels = {
  /** Newest first, older than `before` when given. */
  listTimeline: request(
    'activity.listTimeline',
    'workspace-service',
    z.object({
      projectId: zProjectId,
      limit: z.number().int().min(1).max(200),
      before: zEpochMs.nullable(),
      /** Restrict to one cause, or null for all. */
      cause: ActivityCause.nullable(),
      /** Restrict to one session, or null for all. */
      sessionId: zClaudeSessionId.nullable(),
    }),
    z.array(ActivityEntry),
  ),
  entryAdded: event('activity.entryAdded', 'workspace-service', ActivityEntry),

  /** Newest first. `query` filters by a case-insensitive match on the relative path. */
  listArtifacts: request(
    'activity.listArtifacts',
    'workspace-service',
    z.object({ projectId: zProjectId, query: z.string().max(200) }),
    z.array(Artifact),
  ),
  artifactsChanged: event('activity.artifactsChanged', 'workspace-service', zEmpty),
  pinArtifact: request('activity.pinArtifact', 'workspace-service', z.object({ path: zAbsPath }), zEmpty),
  /** Removes an entry from the inbox. The file itself is untouched. */
  dismissArtifact: request('activity.dismissArtifact', 'workspace-service', z.object({ path: zAbsPath }), zEmpty),
} as const;
