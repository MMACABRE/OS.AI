import { Children, Fragment, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { cx } from './cx';
import styles from './SplitView.module.css';

export type SplitViewProps = {
  readonly direction: 'horizontal' | 'vertical';
  /** Share of the space for each pane, 0 to 1, summing to 1. */
  readonly initialSizes: readonly number[];
  /** Smallest size of each pane in pixels. */
  readonly minSizes: readonly number[];
  readonly onSizesChange?: (sizes: readonly number[]) => void;
  readonly label?: string;
  readonly children: ReactNode;
};

const KEY_STEP = 0.02;

function normalise(sizes: readonly number[], count: number): number[] {
  const list = Array.from({ length: count }, (_, index) => Math.max(0, sizes[index] ?? 1 / count));
  const total = list.reduce((sum, size) => sum + size, 0) || 1;
  return list.map((size) => size / total);
}

/**
 * Panes side by side (`horizontal`) or stacked (`vertical`) with a draggable divider: a 1 px line with a
 * 4 px hit area. The divider is a focusable separator; arrow keys move it. Sizes never go below `minSizes`.
 */
export function SplitView({
  direction,
  initialSizes,
  minSizes,
  onSizesChange,
  label = 'Resize',
  children,
}: SplitViewProps) {
  const panes = Children.toArray(children);
  const [sizes, setSizes] = useState(() => normalise(initialSizes, panes.length));
  const container = useRef<HTMLDivElement | null>(null);
  const horizontal = direction === 'horizontal';

  const total = () => {
    const rect = container.current?.getBoundingClientRect();
    return Math.max(1, (horizontal ? rect?.width : rect?.height) ?? 1);
  };
  /** Moves the divider after pane `index` by `delta` (a share), respecting both neighbours' minimums. */
  const move = (index: number, delta: number) => {
    setSizes((current) => {
      const next = [...current];
      const a = next[index] ?? 0;
      const b = next[index + 1] ?? 0;
      const minA = (minSizes[index] ?? 0) / total();
      const minB = (minSizes[index + 1] ?? 0) / total();
      const clamped = Math.min(b - minB, Math.max(minA - a, delta));
      next[index] = a + clamped;
      next[index + 1] = b - clamped;
      onSizesChange?.(next);
      return next;
    });
  };

  const startDrag = (index: number, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let last = horizontal ? event.clientX : event.clientY;
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const position = horizontal ? moveEvent.clientX : moveEvent.clientY;
      move(index, (position - last) / total());
      last = position;
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const onKey = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== back && event.key !== forward) return;
    event.preventDefault();
    move(index, event.key === forward ? KEY_STEP : -KEY_STEP);
  };

  return (
    <div ref={container} className={cx(styles.split, horizontal ? styles.horizontal : styles.vertical)}>
      {panes.map((pane, index) => (
        <Fragment key={index}>
          <div className={styles.pane} style={{ flexGrow: sizes[index] ?? 0, flexBasis: 0 }}>
            {pane}
          </div>
          {index < panes.length - 1 ? (
            <div
              className={styles.divider}
              role="separator"
              tabIndex={0}
              aria-label={label}
              aria-orientation={horizontal ? 'vertical' : 'horizontal'}
              aria-valuenow={Math.round((sizes[index] ?? 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              onPointerDown={(event) => startDrag(index, event)}
              onKeyDown={(event) => onKey(index, event)}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
