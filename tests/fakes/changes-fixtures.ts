import { ActivityEntry, Artifact } from '@hsos/contracts/channels/activity';
import { RepoStatus } from '@hsos/contracts/channels/git';
import { ReviewFile } from '@hsos/contracts/channels/review';
import { abs } from './fixtures';

type Change = 'added' | 'modified' | 'deleted' | 'renamed' | 'conflicted';

export function reviewFile(
  relPath: string,
  change: Change = 'modified',
  added: number | null = 1,
  removed: number | null = 0,
): ReviewFile {
  return ReviewFile.parse({
    path: abs(relPath.replace(/\//g, '\\')),
    relPath,
    change,
    linesAdded: added,
    linesRemoved: removed,
    isBinary: false,
  });
}

/** A repo status for the project root, clean unless `input` says otherwise. */
export function repoStatus(root: string, input: Record<string, unknown> = {}): RepoStatus {
  return RepoStatus.parse({
    kind: 'repo',
    root,
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    files: [],
    operation: 'none',
    lastFetchAt: null,
    isOffline: false,
    remoteUrl: null,
    webUrl: null,
    busy: 'none',
    ...input,
  });
}

export function entry(id: string, relPath: string, input: Record<string, unknown> = {}): ActivityEntry {
  return ActivityEntry.parse({
    snapshotId: id.padEnd(12, '_'),
    path: abs(relPath.replace(/\//g, '\\')),
    relPath,
    time: Date.now() - 10_000,
    change: 'changed',
    cause: 'owner',
    sessionId: null,
    sessionTitle: null,
    linesAdded: 1,
    linesRemoved: 0,
    ...input,
  });
}

export function artifact(
  relPath: string,
  kind: 'html' | 'pdf' | 'image' | 'video',
  input: Record<string, unknown> = {},
): Artifact {
  return Artifact.parse({
    path: abs(relPath.replace(/\//g, '\\')),
    relPath,
    kind,
    size: 100,
    modifiedAt: Date.now() - 60_000,
    sessionId: null,
    sessionTitle: null,
    isPinned: false,
    ...input,
  });
}
