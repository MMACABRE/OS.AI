/** Joins the class names that are set. */
export const cls = (...names: readonly (string | false | null | undefined)[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');

/** "just now", "12 min ago", "3 h ago", "5 d ago", then the date. */
export function relativeTime(time: number, now: number = Date.now()): string {
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d ago`;
  return new Date(time).toLocaleDateString();
}

/** The last folder of a path: the project's name in the picker and history (SESS-71). */
export const folderName = (path: string): string => path.slice(path.lastIndexOf('\\') + 1) || path;

/** The first line of a note, for a muted preview (SESS-72). */
export const firstLine = (note: string): string => note.split('\n')[0] ?? '';
