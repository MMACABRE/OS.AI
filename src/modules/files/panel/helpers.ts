import { toAbsPath } from '@hsos/contracts/ids';
import type { AbsPath } from '@hsos/contracts/ids';
import type { IconName } from '@hsos/ui-kit';

/** A child's path inside a folder, in the AbsPath form. */
export const joinPath = (dir: string, name: string): AbsPath => toAbsPath(`${dir}\\${name}`);

/** The last part of a path. */
export const baseName = (path: string): string => path.slice(path.lastIndexOf('\\') + 1);

/** The folder that holds a path. */
export const parentOf = (path: string): AbsPath => toAbsPath(path.slice(0, path.lastIndexOf('\\')));

/** The icon for a file, by its extension (visual-direction.md "Shape"). */
export function iconFor(name: string): IconName {
  if (/\.(md|mdx)$/i.test(name)) return 'file-markdown';
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(name)) return 'file-image';
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css|html|ps1|py|rs|go|java|cs|cpp|c|h|sh|yml|yaml|toml)$/i.test(name))
    return 'file-code';
  return 'file';
}

/** Joins the class names that are set. */
export const cls = (...names: readonly (string | false | null | undefined)[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');

/** A size in bytes as the owner reads it: 812 B, 14.2 KB, 3.4 MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
