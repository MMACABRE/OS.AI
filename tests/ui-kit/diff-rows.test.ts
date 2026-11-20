import { describe, expect, it } from 'vitest';
import { diffRows, foldRows, pairRows } from '../../src/modules/ui-kit/components/diff-rows';
import type { DiffRow } from '../../src/modules/ui-kit/components/diff-rows';

const view = (rows: readonly DiffRow[] | null) =>
  rows?.map((row) => [row.kind, row.text, row.before, row.after]);

describe('diff rows (ui-kit)', () => {
  it('UI-DIFF-1 numbers each row on both sides', () => {
    expect(view(diffRows('a\nb\nc', 'a\nB\nc'))).toEqual([
      ['same', 'a', 1, 1],
      ['removed', 'b', 2, null],
      ['added', 'B', null, 2],
      ['same', 'c', 3, 3],
    ]);
  });

  it('REV-22 twenty unchanged lines fold into one row, and expanding its start shows all twenty', () => {
    const middle = Array.from({ length: 20 }, (_, index) => `same ${index}`).join('\n');
    const rows = diffRows(`A\n${middle}\nZ`, `a\n${middle}\nz`) ?? [];
    const folded = foldRows(rows, new Set());
    const folds = folded.filter((item) => item.kind === 'fold');
    expect(folds).toHaveLength(1);
    const fold = folds[0];
    expect(fold?.kind === 'fold' ? fold.end - fold.start : 0).toBe(20);
    const start = fold?.kind === 'fold' ? fold.start : -1;
    const open = foldRows(rows, new Set([start]));
    expect(open.some((item) => item.kind === 'fold')).toBe(false);
    expect(open.filter((item) => item.kind === 'row' && rows[item.index]?.kind === 'same')).toHaveLength(20);
  });

  it('UI-DIFF-2 pairs removed, removed, added as [r1,a1] and [r2,null]', () => {
    const rows: DiffRow[] = [
      { kind: 'removed', text: 'r1', before: 1, after: null },
      { kind: 'removed', text: 'r2', before: 2, after: null },
      { kind: 'added', text: 'a1', before: null, after: 1 },
    ];
    expect(pairRows(rows, [0, 1, 2])).toEqual([
      [0, 2],
      [1, null],
    ]);
  });
});
