import type { ReactNode } from 'react';
import { cx } from './cx';
import { EmptyState } from './EmptyState';
import type { StateAction } from './EmptyState';
import { ErrorState } from './ErrorState';
import styles from './PanelFrame.module.css';
import { Skeleton } from './Skeleton';

/** The four designed states of every panel (P-40, ui-kit.md). */
export type PanelViewState =
  | { readonly kind: 'loading'; readonly label?: string }
  | {
      readonly kind: 'empty';
      readonly message: string;
      readonly title?: string;
      readonly action?: StateAction;
    }
  | { readonly kind: 'error'; readonly message: string; readonly onRetry?: () => void }
  | { readonly kind: 'ready' };

export type PanelFrameProps = {
  readonly title: string;
  readonly actions?: ReactNode;
  readonly state: PanelViewState;
  /** The status light beside the title: live (cyan, blinking), needs-you (red, blinking), value (yellow). */
  readonly light?: 'live' | 'needsYou' | 'value' | null;
  readonly children?: ReactNode;
};

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The dithered strip under a box title, fading left to right, as an SVG mask (dithering is the only blend). */
const DITHER_MASK = (() => {
  const width = 64;
  const rects: string[] = [];
  for (let y = 0; y < 3; y += 1)
    for (let x = 0; x < width; x += 1)
      if (1 - x / width > ((BAYER_4[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16)
        rects.push(`<rect x='${x}' y='${y}' width='1' height='1'/>`);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} 3' preserveAspectRatio='none' shape-rendering='crispEdges'>${rects.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/** An 8 by 8 pixel "box" icon drawn in square cells (visual-direction.md "Shape"). */
const BOX_ICON = [
  '########',
  '#......#',
  '#.####.#',
  '#......#',
  '#.###..#',
  '#......#',
  '########',
  '........',
];

function PixelIcon({ rows }: { readonly rows: readonly string[] }) {
  return (
    <svg className={styles.icon} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/**
 * A box: 2 px frame, corner brackets, an uppercase title with a pixel icon and a status light, a dithered
 * strip, and a hard pixel offset under it (visual-direction.md "Shape"). It draws the panel's state; the
 * children render only when the state is `ready` (P-40). In the error state the frame turns `state.danger`.
 */
export function PanelFrame({ title, actions, state, light = null, children }: PanelFrameProps) {
  return (
    <section className={cx(styles.frame, state.kind === 'error' && styles.error)} aria-label={title}>
      <i className={cx(styles.corner, styles.topLeft)} aria-hidden="true" />
      <i className={cx(styles.corner, styles.topRight)} aria-hidden="true" />
      <i className={cx(styles.corner, styles.bottomLeft)} aria-hidden="true" />
      <i className={cx(styles.corner, styles.bottomRight)} aria-hidden="true" />
      <header className={styles.header}>
        <PixelIcon rows={BOX_ICON} />
        <h2 className={styles.title}>{title}</h2>
        {light === null ? null : <i className={cx(styles.light, styles[light])} aria-hidden="true" />}
        {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
      </header>
      <div
        className={styles.strip}
        style={{ maskImage: DITHER_MASK, WebkitMaskImage: DITHER_MASK }}
        aria-hidden="true"
      />
      <div className={styles.body}>
        {state.kind === 'loading' ? (
          <Skeleton rows={4} label={state.label ?? `Loading ${title.toLowerCase()}`} />
        ) : null}
        {state.kind === 'empty' ? (
          <EmptyState
            message={state.message}
            {...(state.title === undefined ? {} : { title: state.title })}
            {...(state.action === undefined ? {} : { action: state.action })}
          />
        ) : null}
        {state.kind === 'error' ? (
          <ErrorState
            message={state.message}
            {...(state.onRetry === undefined ? {} : { onRetry: state.onRetry })}
          />
        ) : null}
        {state.kind === 'ready' ? children : null}
      </div>
    </section>
  );
}
