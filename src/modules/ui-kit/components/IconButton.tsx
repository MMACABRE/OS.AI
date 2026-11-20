import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useLift } from '../motion/motion';
import { cx } from './cx';
import styles from './IconButton.module.css';
import { Tooltip } from './Tooltip';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'type' | 'disabled'> & {
  /** Usually an `<Icon>`; it is hidden from screen readers, `label` names the button. */
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  /** For toggle buttons: whether it is on. */
  readonly pressed?: boolean;
  /** Shown in the tooltip beside the label (UI-3). */
  readonly keyBinding?: string | null;
  readonly disabled?: boolean;
};

/**
 * A 24 by 24 icon-only button with an accessible name and a tooltip (UI-3).
 * It forwards its ref and every other prop to the `<button>`, so a Radix trigger (Menu, Popover) can use it with `asChild` (UI-MENU-1).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, onPress, pressed, keyBinding, disabled = false, className, onPointerDown, onPointerUp, onPointerMove, onPointerLeave, ...rest },
  ref,
) {
  const lift = useLift();
  return (
    <Tooltip text={label} keyBinding={keyBinding ?? null}>
      <button
        {...rest}
        ref={ref}
        type="button"
        className={cx(styles.button, pressed === true && styles.pressed, className)}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onPress}
        onPointerDown={(event) => {
          lift.onPointerDown(event);
          onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          lift.onPointerUp(event);
          onPointerUp?.(event);
        }}
        onPointerMove={(event) => {
          lift.onPointerMove(event);
          onPointerMove?.(event);
        }}
        onPointerLeave={(event) => {
          lift.onPointerLeave(event);
          onPointerLeave?.(event);
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      </button>
    </Tooltip>
  );
});
