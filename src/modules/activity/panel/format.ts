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

/** The time of day in the owner's locale, for a timeline row. */
export const clockOf = (time: number): string => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** "Today", "Yesterday", or the date (ACT-10). */
export function dayLabel(time: number, now: number = Date.now()): string {
  const day = new Date(time);
  const today = new Date(now);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(day, today)) return 'Today';
  const yesterday = new Date(now - 86_400_000);
  if (sameDay(day, yesterday)) return 'Yesterday';
  return day.toLocaleDateString();
}

/** `+12 −3`, or `binary` when the change has no line counts (ACT-5). */
export function countsOf(added: number | null, removed: number | null): string {
  if (added === null || removed === null) return 'binary';
  return `+${added} −${removed}`;
}

/** The folder part and the file name of a project-relative path (ACT-10: the file name is emphasised). */
export function splitPath(relPath: string): { readonly folder: string; readonly name: string } {
  const slash = relPath.lastIndexOf('/');
  return { folder: slash < 0 ? '' : relPath.slice(0, slash + 1), name: relPath.slice(slash + 1) };
}
