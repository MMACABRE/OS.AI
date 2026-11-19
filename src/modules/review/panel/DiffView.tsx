import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CommentTarget, PinnedComment } from '@hsos/contracts/channels/review';
import type { AbsPath } from '@hsos/contracts/ids';
import { Button, IconButton, Icon } from '@hsos/ui-kit';
import { cls } from './helpers';
import { diffLines } from './line-diff';
import type { DiffLine } from './line-diff';
import styles from './DiffView.module.css';

/** A diff line with its numbers in the old and the new file (REV-23 targets use them). */
export type DiffRow = {
  readonly kind: DiffLine['kind'];
  readonly text: string;
  readonly before: number | null;
  readonly after: number | null;
};

/** Numbers the lines of a diff: the old file counts removed and unchanged lines, the new one added and unchanged. */
export function numberRows(lines: readonly DiffLine[]): DiffRow[] {
  let before = 1;
  let after = 1;
  return lines.map((line) => {
    if (line.kind === 'same') {
      const row: DiffRow = { kind: 'same', text: line.text, before, after };
      before += 1;
      after += 1;
      return row;
    }
    if (line.kind === 'added') {
      const row: DiffRow = { kind: 'added', text: line.text, before: null, after };
      after += 1;
      return row;
    }
    const row: DiffRow = { kind: 'removed', text: line.text, before, after: null };
    before += 1;
    return row;
  });
}

/** Both sides of a file, or null when the files are too large to compare here. */
export function rowsFor(before: string, after: string): DiffRow[] | null {
  const lines = diffLines(before.split('\n'), after.split('\n'));
  return lines === null ? null : numberRows(lines);
}

/** REV-23: the comment target of one line; a removed line pins to the old file (REV-31). */
export function targetOf(row: DiffRow, path: AbsPath): CommentTarget {
  const quote = row.text.slice(0, 300);
  if (row.kind === 'removed') return { kind: 'diff-line', path, line: row.before ?? 1, side: 'before', quote };
  return { kind: 'diff-line', path, line: row.after ?? 1, side: 'after', quote };
}

/** Unchanged runs longer than this fold into one row (REV-22). */
const FOLD_OVER = 8;

type Item = { readonly kind: 'row'; readonly index: number } | { readonly kind: 'fold'; readonly start: number; readonly end: number };

export type DiffViewProps = {
  readonly rows: readonly DiffRow[];
  readonly path: AbsPath;
  readonly comments: readonly PinnedComment[];
  readonly onAdd: (target: CommentTarget, text: string) => void;
  readonly onRemove: (id: PinnedComment['id']) => void;
};

/**
 * Inline diff of one file (REV-20 to REV-24): unchanged runs fold, F7 and Shift+F7 move between changes, and a
 * line takes a comment from its "+" control or the C key.
 */
export function DiffView({ rows, path, comments, onAdd, onRemove }: DiffViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [composing, setComposing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const changed = useMemo(() => rows.flatMap((row, index) => (row.kind === 'same' ? [] : [index])), [rows]);
  const [cursor, setCursor] = useState(-1);

  const items = useMemo(() => {
    const out: Item[] = [];
    let index = 0;
    while (index < rows.length) {
      const row = rows[index];
      if (row?.kind === 'same') {
        let end = index;
        while (end < rows.length && rows[end]?.kind === 'same') end += 1;
        if (end - index > FOLD_OVER && !expanded.has(index)) {
          out.push({ kind: 'fold', start: index, end });
        } else for (let at = index; at < end; at += 1) out.push({ kind: 'row', index: at });
        index = end;
      } else {
        out.push({ kind: 'row', index });
        index += 1;
      }
    }
    return out;
  }, [rows, expanded]);

  const reveal = (index: number) => {
    const node = container.current?.querySelector<HTMLElement>(`[data-row="${index}"]`);
    node?.scrollIntoView({ block: 'center' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'F7' && changed.length > 0) {
      event.preventDefault();
      const next = event.shiftKey
        ? [...changed].reverse().find((index) => index < cursor) ?? changed[changed.length - 1]
        : changed.find((index) => index > cursor) ?? changed[0];
      if (next !== undefined) {
        setCursor(next);
        reveal(next);
      }
    }
  };

  const save = (index: number) => {
    const row = rows[index];
    const text = draft.trim();
    if (row === undefined || text === '') return;
    onAdd(targetOf(row, path), text);
    setComposing(null);
    setDraft('');
  };

  const commentsAt = (row: DiffRow) =>
    comments.filter(
      (comment) =>
        comment.target.kind === 'diff-line' &&
        comment.target.path === path &&
        comment.target.side === (row.kind === 'removed' ? 'before' : 'after') &&
        comment.target.line === (row.kind === 'removed' ? row.before : row.after),
    );

  return (
    <div ref={container} className={styles.diff} tabIndex={0} role="region" aria-label="Diff" onKeyDown={onKeyDown}>
      {items.map((item) => {
        if (item.kind === 'fold')
          return (
            <button
              key={`fold-${item.start}`}
              type="button"
              className={styles.fold}
              onClick={() => setExpanded((current) => new Set(current).add(item.start))}
            >
              {`⋯ ${item.end - item.start} unchanged lines`}
            </button>
          );
        const row = rows[item.index];
        if (row === undefined) return null;
        const lineNo = row.kind === 'removed' ? row.before : row.after;
        const sign = row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' ';
        return (
          <div key={item.index} className={styles.group}>
            <div
              data-row={item.index}
              className={cls(styles.line, styles[row.kind])}
              tabIndex={-1}
              onKeyDown={(event) => {
                // REV-23: C on a focused line opens the comment box.
                if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                  event.preventDefault();
                  setComposing(item.index);
                  setDraft('');
                }
              }}
            >
              <span className={styles.no} aria-hidden="true">
                {lineNo ?? ''}
              </span>
              <span className={styles.sign} aria-hidden="true">
                {sign}
              </span>
              <span className={styles.text}>{row.text}</span>
              <span className={styles.add}>
                <IconButton
                  icon={<Icon name="comment" />}
                  label={`Comment on line ${lineNo ?? ''}`}
                  onPress={() => {
                    setComposing(item.index);
                    setDraft('');
                  }}
                />
              </span>
            </div>
            {commentsAt(row).map((comment) => (
              <div key={comment.id} className={styles.comment}>
                <span className={styles.commentText}>{comment.text}</span>
                <Button size="small" variant="ghost" onPress={() => onRemove(comment.id)}>
                  Remove
                </Button>
              </div>
            ))}
            {composing === item.index ? (
              <div className={styles.composer}>
                <textarea
                  className={styles.field}
                  aria-label="Comment on this line"
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.ctrlKey) {
                      event.preventDefault();
                      save(item.index);
                    } else if (event.key === 'Escape') setComposing(null);
                  }}
                />
                <div className={styles.composerActions}>
                  <Button size="small" onPress={() => save(item.index)}>
                    Add comment
                  </Button>
                  <Button size="small" variant="ghost" onPress={() => setComposing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
