import type { ReactNode } from 'react';
import { useLift } from '../motion/motion';
import { cx } from './cx';
import styles from './Button.module.css';

export type ButtonProps = {
  readonly variant?: 'primary' | 'default' | 'ghost' | 'danger';
  readonly size?: 'small' | 'normal';
  /** Usually an `<Icon>`. */
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  /** A toggle: shown as `primary` while on, and announced with `aria-pressed`. */
  readonly pressed?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
};

/** A labelled button. One `primary` at most per view (ui-kit.md "Components"). */
export function Button({
  variant = 'default',
  size = 'normal',
  icon,
  disabled = false,
  pressed,
  onPress,
  children,
}: ButtonProps) {
  const lift = useLift();
  return (
    <button
      type="button"
      className={cx(styles.button, styles[pressed === true ? 'primary' : variant], styles[size])}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onPress}
      {...lift}
    >
      {icon === undefined ? null : (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
