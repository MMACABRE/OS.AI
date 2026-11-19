import { diffArrays } from 'diff';

/** One line of a diff with its numbers in the old and the new file (REV-23 targets use them). */
export type DiffRow = {
  readonly kind: 'same' | 'added' | 'removed';
  readonly text: string;
  /** Line number in the old file, null for an added line. */
  readonly before: number | null;
  /** Line number in the new file, null for a removed line. */
  readonly after: number | null;
};

/** Past this many milliseconds the diff gives up and the view says the files are too large. */
export const DIFF_TIMEOUT_MS = 1000;

/** The line diff of two texts (`diff` package), numbered on both sides; null when it took too long. */
export function diffRows(before: string, after: string): DiffRow[] | null {
  const changes = diffArrays(before.split('\n'), after.split('\n'), { timeout: DIFF_TIMEOUT_MS });
  if (changes === undefined) return null;
  const rows: DiffRow[] = [];
  let old = 1;
  let next = 1;
  for (const change of changes) {
    for (const text of change.value) {
      if (change.added) rows.push({ kind: 'added', text, before: null, after: next++ });
      else if (change.removed) rows.push({ kind: 'removed', text, before: old++, after: null });
      else rows.push({ kind: 'same', text, before: old++, after: next++ });
    }
  }
  return rows;
}

/** Unchanged runs longer than this fold into one row (REV-22). */
export const FOLD_OVER = 8;

export type DiffItem =
  | { readonly kind: 'row'; readonly index: number }
  | { readonly kind: 'fold'; readonly start: number; readonly end: number };

/** Rows to draw: unchanged runs over `FOLD_OVER` lines become one fold unless their start is in `expanded`. */
export function foldRows(rows: readonly DiffRow[], expanded: ReadonlySet<number>): DiffItem[] {
  const out: DiffItem[] = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index]?.kind !== 'same') {
      out.push({ kind: 'row', index });
      index += 1;
      continue;
    }
    let end = index;
    while (end < rows.length && rows[end]?.kind === 'same') end += 1;
    if (end - index > FOLD_OVER && !expanded.has(index)) out.push({ kind: 'fold', start: index, end });
    else for (let at = index; at < end; at += 1) out.push({ kind: 'row', index: at });
    index = end;
  }
  return out;
}

/** Split mode: each removed run sits beside the added run after it; unchanged lines fill both sides. */
export function pairRows(rows: readonly DiffRow[], indexes: readonly number[]): [number | null, number | null][] {
  const pairs: [number | null, number | null][] = [];
  let at = 0;
  while (at < indexes.length) {
    const index = indexes[at] as number;
    const row = rows[index];
    if (row?.kind === 'same') {
      pairs.push([index, index]);
      at += 1;
      continue;
    }
    const removed: number[] = [];
    const added: number[] = [];
    while (at < indexes.length && rows[indexes[at] as number]?.kind === 'removed') removed.push(indexes[at++] as number);
    while (at < indexes.length && rows[indexes[at] as number]?.kind === 'added') added.push(indexes[at++] as number);
    for (let line = 0; line < Math.max(removed.length, added.length); line += 1)
      pairs.push([removed[line] ?? null, added[line] ?? null]);
  }
  return pairs;
}
