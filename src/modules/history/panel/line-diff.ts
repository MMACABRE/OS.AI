export type DiffLine = { readonly kind: 'same' | 'added' | 'removed'; readonly text: string };

/** Above this many table cells the diff is not computed (about 4 MB of memory). */
const MAX_CELLS = 1_000_000;

/**
 * A line diff by longest common subsequence, in file order. Null when the two files are too large
 * to compare here. The diff views of history and review each keep a copy of this function.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffLine[] | null {
  const n = before.length;
  const m = after.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  const cell = (i: number, j: number): number => table[i * width + j] ?? 0;
  for (let i = n - 1; i >= 0; i -= 1)
    for (let j = m - 1; j >= 0; j -= 1)
      table[i * width + j] =
        before[i] === after[j] ? cell(i + 1, j + 1) + 1 : Math.max(cell(i + 1, j), cell(i, j + 1));

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const a = before[i] ?? '';
    const b = after[j] ?? '';
    if (a === b) {
      out.push({ kind: 'same', text: a });
      i += 1;
      j += 1;
    } else if (cell(i + 1, j) >= cell(i, j + 1)) {
      out.push({ kind: 'removed', text: a });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ kind: 'removed', text: before[i] ?? '' });
    i += 1;
  }
  while (j < m) {
    out.push({ kind: 'added', text: after[j] ?? '' });
    j += 1;
  }
  return out;
}
