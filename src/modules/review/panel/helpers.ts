import type { ReviewFile } from '@hsos/contracts/channels/review';
import type { ReviewBase } from '@hsos/contracts/channels/review';
import type { AbsPath } from '@hsos/contracts/ids';
import { toAbsPath } from '@hsos/contracts/ids';

/** Joins the class names that are set. */
export const cls = (...names: readonly (string | false | null | undefined)[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');

/** The change letter and its word, which the accessible name carries too (REV-11). */
export const CHANGE: Record<ReviewFile['change'], { readonly letter: string; readonly word: string }> = {
  added: { letter: 'A', word: 'Added' },
  modified: { letter: 'M', word: 'Modified' },
  deleted: { letter: 'D', word: 'Deleted' },
  renamed: { letter: 'R', word: 'Renamed' },
  conflicted: { letter: '!', word: 'Conflicted' },
};

/** `+12 −3`; binary files and files above 1 MB have no count (REV-4). */
export function countsOf(file: Pick<ReviewFile, 'linesAdded' | 'linesRemoved' | 'isBinary'>): string {
  if (file.isBinary || file.linesAdded === null || file.linesRemoved === null) return 'binary';
  return `+${file.linesAdded} −${file.linesRemoved}`;
}

/** The key of a base, for effects and selects. */
export const baseKey = (base: ReviewBase): string => (base.kind === 'last-commit' ? 'last-commit' : `session:${base.sessionId}`);

/** A project-relative path with forward slashes, as the feedback prompt shows it (REV-31). */
export const relativeTo = (root: string, path: string): string => path.slice(root.length + 1).replace(/\\/g, '/');

/** An absolute path from a project root and a relative path. */
export const absoluteFrom = (root: string, relPath: string): AbsPath => toAbsPath(`${root}\\${relPath.replace(/\//g, '\\')}`);
