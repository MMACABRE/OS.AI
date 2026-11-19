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

export const absoluteTime = (time: number): string => new Date(time).toLocaleString();

/** A byte change with its sign: +812 B, −14.2 KB. */
export function signedBytes(delta: number): string {
  const size = Math.abs(delta);
  const text = size < 1_000 ? `${size} B` : size < 1_000_000 ? `${(size / 1_000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;
  return `${delta >= 0 ? '+' : '−'}${text}`;
}
