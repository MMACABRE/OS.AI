import { cx } from './cx';
import type { Tone } from './cx';
import styles from './ProgressBar.module.css';

export type ProgressBarProps = {
  /** 0 to 1. */
  readonly value: number;
  readonly tone: Tone;
  /** Read by screen readers. */
  readonly label: string;
};

/** A pixel bar that fills by `value`; its label is the accessible name. Only `transform` animates (MOT-1). */
export function ProgressBar({ value, tone, label }: ProgressBarProps) {
  const share = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
    >
      <div className={cx(styles.fill, styles[tone])} style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}
