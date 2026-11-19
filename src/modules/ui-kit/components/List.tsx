import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { staggerStyle, useEntering } from '../motion/motion';
import { cx } from './cx';
import styles from './List.module.css';
import { useTypeAhead, useVirtualRows } from './virtual-rows';

/** A list row needs an id and its text, which type-ahead and screen readers use. */
export type ListRow = { readonly id: string; readonly text: string };

export type ListProps<Row extends ListRow> = {
  readonly rows: readonly Row[];
  /** Pixels; every row has this height (UI-7). */
  readonly rowHeight: number;
  readonly renderRow: (row: Row, state: { readonly selected: boolean }) => ReactNode;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onActivate: (id: string) => void;
  readonly label: string;
};

/**
 * A keyboard list: Up, Down, Home, End, Page Up and Page Down move the selection, Enter activates,
 * letters jump by type-ahead. Above 200 rows only the visible rows are rendered (UI-7).
 */
export function List<Row extends ListRow>({
  rows,
  rowHeight,
  renderRow,
  selectedId,
  onSelect,
  onActivate,
  label,
}: ListProps<Row>) {
  const baseId = useId();
  const virtual = useVirtualRows(rows.length, rowHeight);
  const entering = useEntering();
  const selectedIndex = rows.findIndex((row) => row.id === selectedId);
  const choose = (index: number) => {
    const row = rows[Math.min(rows.length - 1, Math.max(0, index))];
    if (row === undefined) return;
    onSelect(row.id);
    virtual.scrollToIndex(rows.indexOf(row));
  };
  const typeAhead = useTypeAhead(() => rows.map((row) => row.text), selectedIndex, choose);
  const page = Math.max(
    1,
    Math.floor((virtual.containerRef.current?.clientHeight ?? rowHeight * 10) / rowHeight) - 1,
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => number> = {
      ArrowDown: () => selectedIndex + 1,
      ArrowUp: () => (selectedIndex < 0 ? 0 : selectedIndex - 1),
      Home: () => 0,
      End: () => rows.length - 1,
      PageDown: () => selectedIndex + page,
      PageUp: () => selectedIndex - page,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      choose(move());
    } else if (event.key === 'Enter' && selectedId !== null) {
      event.preventDefault();
      onActivate(selectedId);
    } else if (!event.ctrlKey && !event.altKey && !event.metaKey && typeAhead(event.key))
      event.preventDefault();
  };

  const visible = rows.slice(virtual.start, virtual.end);
  return (
    <div
      ref={virtual.containerRef}
      className={styles.list}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={selectedIndex >= 0 ? `${baseId}-${selectedIndex}` : undefined}
      onKeyDown={onKeyDown}
      onScroll={virtual.onScroll}
    >
      <div className={styles.inner} style={{ height: virtual.totalHeight }}>
        {visible.map((row, offset) => {
          const index = virtual.start + offset;
          const selected = row.id === selectedId;
          return (
            <div
              key={row.id}
              id={`${baseId}-${index}`}
              role="option"
              aria-selected={selected}
              aria-label={row.text}
              className={cx(styles.row, entering && styles.rowEnter, selected && styles.selected)}
              style={{ top: index * rowHeight, height: rowHeight, ...(entering ? staggerStyle(offset) : {}) }}
              onClick={() => onSelect(row.id)}
              onDoubleClick={() => onActivate(row.id)}
            >
              {renderRow(row, { selected })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
