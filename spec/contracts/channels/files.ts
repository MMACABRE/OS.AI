/** Channels owned by the `files` module. Spec: spec/modules/files.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { ExtensionPoint, SettingsSection } from '../module';
import { zAbsPath, zContentHash, zEmpty, zEpochMs, zProjectId, zRelPath } from '../schemas';

export const DirEntry = z.object({
  name: z.string(),
  /** Relative to the root that was listed. */
  relPath: zRelPath,
  kind: z.enum(['file', 'dir']),
  size: z.number().int().nonnegative(),
  modifiedAt: zEpochMs,
  /** Matches a `dimPatterns` setting: shown muted in the tree. */
  isDimmed: z.boolean(),
  isSymlink: z.boolean(),
});
export type DirEntry = z.infer<typeof DirEntry>;

export const TextFormat = z.object({
  encoding: z.enum(['utf8', 'utf8-bom', 'utf16le']),
  eol: z.enum(['lf', 'crlf']),
});
export type TextFormat = z.infer<typeof TextFormat>;

export const FileVersion = z.object({
  path: zAbsPath,
  hash: zContentHash,
  modifiedAt: zEpochMs,
  size: z.number().int().nonnegative(),
});
export type FileVersion = z.infer<typeof FileVersion>;

/** What `read` returns. Only `text` carries content. */
export const FileContent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), version: FileVersion, text: z.string(), format: TextFormat }),
  z.object({ kind: z.literal('image'), version: FileVersion }),
  z.object({ kind: z.literal('binary'), version: FileVersion }),
  z.object({ kind: z.literal('too-large'), version: FileVersion }),
]);
export type FileContent = z.infer<typeof FileContent>;

export const SaveRequest = z.object({
  path: zAbsPath,
  /** Text with `\n` line ends. The service converts to `format.eol` and `format.encoding`. */
  content: z.string(),
  format: TextFormat,
  /** Hash of the content the editor loaded, or null for a new file. */
  baseHash: zContentHash.nullable(),
  /** True only after the owner chose "Overwrite" in the changed-on-disk bar (P-2). */
  overwrite: z.boolean(),
});
export type SaveRequest = z.infer<typeof SaveRequest>;

export const FileChange = z.object({
  path: zAbsPath,
  kind: z.enum(['created', 'changed', 'deleted']),
});
export type FileChange = z.infer<typeof FileChange>;

export const UnsavedBuffer = z.object({
  path: zAbsPath,
  content: z.string(),
  format: TextFormat,
  baseHash: zContentHash.nullable(),
  savedAt: zEpochMs,
});
export type UnsavedBuffer = z.infer<typeof UnsavedBuffer>;

export const FileMatch = z.object({
  path: zAbsPath,
  relPath: zRelPath,
  /** Higher is better. */
  score: z.number(),
});
export type FileMatch = z.infer<typeof FileMatch>;

export const FilesSettings = z.object({
  /** Folder and file names hidden from the tree. */
  hidePatterns: z.array(z.string()).default(['.git']),
  /** Names shown muted and left out of file search. */
  dimPatterns: z
    .array(z.string())
    .default(['node_modules', 'dist', 'build', 'out', '.next', 'target', '.venv', '__pycache__']),
  /** Glob patterns the watcher ignores. */
  watcherExclude: z.array(z.string()).default(['**/.git/objects/**', '**/node_modules/**']),
  /** Text files above this size open as `too-large`. */
  maxEditableBytes: z.number().int().min(100_000).max(50_000_000).default(5_000_000),
  editorFontSize: z.number().int().min(8).max(32).default(13),
  wordWrap: z.boolean().default(false),
  /** Open markdown files in preview first. */
  markdownPreviewFirst: z.boolean().default(true),
  confirmTrash: z.boolean().default(true),
});
export type FilesSettings = z.infer<typeof FilesSettings>;

export const filesSection: SettingsSection<FilesSettings> = {
  moduleId: 'files',
  title: 'Files',
  schema: FilesSettings,
  defaults: FilesSettings.parse({}),
};

export const filesChannels = {
  /** Lists one folder, folders first, then files, each sorted by name without regard to case. */
  listDir: request('files.listDir', 'workspace-service', z.object({ dir: zAbsPath }), z.array(DirEntry)),
  read: request('files.read', 'workspace-service', z.object({ path: zAbsPath }), FileContent),
  /** Current version of a file without its content. */
  stat: request('files.stat', 'workspace-service', z.object({ path: zAbsPath }), FileVersion),
  save: request('files.save', 'workspace-service', SaveRequest, FileVersion, 30_000),

  /**
   * Writes raw bytes atomically with observers run, for `history` restores only.
   * The renderer may not call it: the handler returns BAD_REQUEST for callers outside
   * workspace-service (FILE-27).
   */
  writeBytes: request(
    'files.writeBytes',
    'workspace-service',
    z.object({ path: zAbsPath, bytes: z.instanceof(Uint8Array), cause: z.literal('restore') }),
    FileVersion,
    30_000,
  ),

  createFile: request('files.createFile', 'workspace-service', z.object({ path: zAbsPath }), FileVersion),
  createDir: request('files.createDir', 'workspace-service', z.object({ path: zAbsPath }), zEmpty),
  rename: request('files.rename', 'workspace-service', z.object({ from: zAbsPath, to: zAbsPath }), zEmpty),
  /** Moves to the Recycle Bin through shell.trashItem (P-1). */
  trash: request('files.trash', 'workspace-service', z.object({ path: zAbsPath }), zEmpty),

  /** Fuzzy match on file names and relative paths in the current project. */
  search: request(
    'files.search',
    'workspace-service',
    z.object({ query: z.string().max(200), limit: z.number().int().min(1).max(200) }),
    z.array(FileMatch),
  ),

  /** A batch of watcher hints. Receivers re-read before acting (P-16). */
  changed: event('files.changed', 'workspace-service', z.object({ changes: z.array(FileChange) })),

  /** The watcher lost events. Consumers reload everything they show (FILE-43). */
  rescanNeeded: event('files.rescanNeeded', 'workspace-service', zEmpty),

  storeUnsaved: request('files.storeUnsaved', 'workspace-service', UnsavedBuffer, zEmpty),
  listUnsaved: request(
    'files.listUnsaved',
    'workspace-service',
    z.object({ projectId: zProjectId }),
    z.array(UnsavedBuffer),
  ),
  discardUnsaved: request('files.discardUnsaved', 'workspace-service', z.object({ path: zAbsPath }), zEmpty),
} as const;

/**
 * Other modules in workspace-service observe writes made by `files` by contributing
 * one of these (see ExtensionPoint in contracts/module.ts). `history` uses it.
 */
export type FileWriteObserver = {
  /** Runs before `files` replaces or removes a file. `previous` is null when the file does not exist. */
  beforeWrite(path: string, previous: Uint8Array | null): Promise<void>;
  /** Runs after a successful write. */
  afterWrite(path: string, content: Uint8Array, cause: 'save' | 'create' | 'restore'): Promise<void>;
  /** Runs before `files` sends a file to the Recycle Bin. */
  beforeTrash(path: string, previous: Uint8Array | null): Promise<void>;
};

export const fileWriteObservers: ExtensionPoint<FileWriteObserver> = { id: 'files.writeObservers' };

/** The seam between the files service and the real watcher library. */
export type FileWatcher = {
  /** Starts watching `root`. `onChanges` receives batches. Returns a function that stops watching. */
  watch(
    root: string,
    exclude: readonly string[],
    onChanges: (changes: readonly { path: string; kind: 'created' | 'changed' | 'deleted' }[]) => void,
  ): Promise<() => Promise<void>>;
};
