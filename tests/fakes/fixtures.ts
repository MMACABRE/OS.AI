import { DirEntry, FileContent } from '@hsos/contracts/channels/files';
import type { FileContent as FileContentType } from '@hsos/contracts/channels/files';
import { ProjectInfo } from '@hsos/contracts/channels/workspace';
import { toAbsPath } from '@hsos/contracts/ids';
import type { AbsPath } from '@hsos/contracts/ids';

/** The open project used across component tests. */
export const PROJECT = ProjectInfo.parse({ id: '0123456789abcdef', path: 'C:\\code\\hsos', name: 'hsos' });

export const abs = (relative: string): AbsPath => toAbsPath(`${PROJECT.path}\\${relative}`);

/** A directory entry built through the contract schema. */
export function dirEntry(
  name: string,
  kind: 'file' | 'dir' = 'file',
  extra: { readonly isDimmed?: boolean } = {},
): DirEntry {
  return DirEntry.parse({
    name,
    relPath: name,
    kind,
    size: 10,
    modifiedAt: 0,
    isDimmed: extra.isDimmed ?? false,
    isSymlink: false,
  });
}

const HASH_A = 'a'.repeat(64);

/** A text FileContent. `hash` is one hex digit repeated 64 times. */
export function textContent(path: AbsPath, text: string, hashDigit = 'a'): FileContentType {
  return FileContent.parse({
    kind: 'text',
    version: { path, hash: hashDigit.repeat(64), modifiedAt: 0, size: text.length },
    text,
    format: { encoding: 'utf8', eol: 'lf' },
  });
}

/** A binary, too-large or image FileContent. */
export function otherContent(
  path: AbsPath,
  kind: 'binary' | 'too-large' | 'image',
  size = 2048,
): FileContentType {
  return FileContent.parse({ kind, version: { path, hash: HASH_A, modifiedAt: 0, size } });
}
