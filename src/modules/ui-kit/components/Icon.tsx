import { ICONS } from '../icons';
import type { IconName } from '../icons';

export type IconProps = {
  readonly name: IconName;
  /** Pixels: 8 cells scaled by whole numbers (16 is 2 px a cell). */
  readonly size?: 8 | 16 | 24 | 32;
};

/** A pixel icon drawn in `currentColor` as square cells (visual-direction.md "Shape"). Decorative: hidden from screen readers. */
export function Icon({ name, size = 16 }: IconProps) {
  const rows = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
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
