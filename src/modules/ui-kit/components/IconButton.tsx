import type { ReactNode } from 'react';
import { useLift } from '../motion/motion';
import { cx } from './cx';
import styles from './IconButton.module.css';
import { Tooltip } from './Tooltip';

export type IconButtonProps = {
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

/** A 24 by 24 icon-only button with an accessible name and a tooltip (UI-3). */
export function IconButton({ icon, label, onPress, pressed, keyBinding, disabled = false }: IconButtonProps) {
  const lift = useLift();
  return (
    <Tooltip text={label} keyBinding={keyBinding ?? null}>
      <button
        type="button"
        className={cx(styles.button, pressed === true && styles.pressed)}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onPress}
        {...lift}
      >
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      </button>
    </Tooltip>
  );
}
