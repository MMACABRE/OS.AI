import { Fragment, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { diffRows, foldRows, pairRows } from './diff-rows';
import type { DiffItem, DiffRow } from './diff-rows';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import styles from './DiffView.module.css';

export type DiffViewProps = {
  readonly before: string;
  readonly after: string;
  readonly mode?: 'inline' | 'split';
  /** Names the diff for screen readers. */
  readonly label?: string;
  /** A control at the end of each line, also run by the C key on a focused line (REV-23). */
  readonly onLineAction?: (row: DiffRow) => void;
  readonly lineActionLabel?: (row: DiffRow) => string;
  /** Content shown under a line, such as the comments pinned to it. */
  readonly renderBelow?: (row: DiffRow) => ReactNode;
};

const SIGN = { same: ' ', added: '+', removed: '−' } as const;

/**
 * The diff of two texts, used by `files`, `history` and `review` (ui-kit.md). Lines come from the `diff`
 * package; unchanged runs fold (REV-22); F7 and Shift+F7 move between changes. The scroll position stays
 * when `before` or `after` change, because the view keeps its element (REV-20).
 */
export function DiffView({
  before,
  after,
  mode = 'inline',
  label = 'Diff',
  onLineAction,
  lineActionLabel,
  renderBelow,
}: DiffViewProps) {
  const rows = useMemo(() => diffRows(before, after), [before, after]);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [cursor, setCursor] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const items = useMemo(() => (rows === null ? [] : foldRows(rows, expanded)), [rows, expanded]);
  const changed = useMemo(
    () => (rows ?? []).flatMap((row, index) => (row.kind === 'same' ? [] : [index])),
    [rows],
  );

  if (rows === null) return <p className={styles.note}>This diff is too large to show.</p>;
  if (changed.length === 0) return <p className={styles.note}>No differences.</p>;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'F7') return;
    event.preventDefault();
    const next = event.shiftKey
      ? ([...changed].reverse().find((index) => index < cursor) ?? changed[changed.length - 1])
      : (changed.find((index) => index > cursor) ?? changed[0]);
    if (next === undefined) return;
    setCursor(next);
    // A change inside a fold cannot be hidden: folds hold only unchanged lines.
    const node = container.current?.querySelector<HTMLElement>(`[data-row="${next}"]`);
    node?.scrollIntoView({ block: 'center' });
    node?.focus();
  };

  const line = (index: number | null, side?: 'before' | 'after') => {
    const row = index === null ? undefined : rows[index];
    if (index === null || row === undefined) return <div className={cx(styles.line, styles.blank)} aria-hidden="true" />;
    const number = side === 'before' || (side === undefined && row.kind === 'removed') ? row.before : row.after;
    return (
      <div
        data-row={side === 'before' && row.kind === 'same' ? undefined : index}
        className={cx(styles.line, styles[row.kind], index === cursor && styles.current)}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (onLineAction === undefined || event.ctrlKey || event.altKey || event.metaKey) return;
          if (event.key.toLowerCase() !== 'c') return;
          event.preventDefault();
          onLineAction(row);
        }}
      >
        <span className={styles.no} aria-hidden="true">
          {number ?? ''}
        </span>
        <span className={styles.sign} aria-hidden="true">
          {SIGN[row.kind]}
        </span>
        <span className={styles.text}>{row.text}</span>
        {onLineAction === undefined ? null : (
          <span className={styles.action}>
            <IconButton
              icon={<Icon name="comment" />}
              label={lineActionLabel?.(row) ?? `Comment on line ${number ?? ''}`}
              onPress={() => onLineAction(row)}
            />
          </span>
        )}
      </div>
    );
  };

  const fold = (item: Extract<DiffItem, { kind: 'fold' }>) => (
    <button
      key={`fold-${item.start}`}
      type="button"
      className={styles.fold}
      onClick={() => setExpanded((current) => new Set(current).add(item.start))}
    >
      {`⋯ ${item.end - item.start} unchanged lines`}
    </button>
  );

  const below = (index: number | null) => {
    const row = index === null ? undefined : rows[index];
    return row === undefined ? null : renderBelow?.(row);
  };

  // Split mode pairs the visible rows between folds.
  const blocks: ReactNode[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length === 0) return;
    for (const [left, right] of pairRows(rows, run)) {
      const key = `${left ?? 'x'}-${right ?? 'x'}`;
      blocks.push(
        <Fragment key={key}>
          <div className={styles.pair}>
            {line(left, 'before')}
            {line(right, 'after')}
          </div>
          {below(left !== null && rows[left]?.kind === 'removed' ? left : null)}
          {below(right)}
        </Fragment>,
      );
    }
    run = [];
  };
  if (mode === 'split') {
    for (const item of items) {
      if (item.kind === 'row') run.push(item.index);
      else {
        flush();
        blocks.push(fold(item));
      }
    }
    flush();
  }

  return (
    <div
      ref={container}
      className={cx(styles.diff, mode === 'split' && styles.split)}
      tabIndex={0}
      role="region"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {mode === 'split'
        ? blocks
        : items.map((item) =>
            item.kind === 'fold' ? (
              fold(item)
            ) : (
              <Fragment key={item.index}>
                {line(item.index)}
                {below(item.index)}
              </Fragment>
            ),
          )}
    </div>
  );
}
