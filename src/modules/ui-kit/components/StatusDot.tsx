import { cx } from './cx';
import type { Tone } from './cx';
import styles from './StatusDot.module.css';

export type StatusDotProps = {
  readonly tone: Tone | 'neutral';
  /** The state in words; the dot's accessible name, so colour is never the only signal (P-43). */
  readonly label: string;
  /** Pulses once when it first appears or its tone changes. */
  readonly pulseOnce?: boolean;
};

/** An 8 px status light with its state as the accessible name. */
export function StatusDot({ tone, label, pulseOnce = false }: StatusDotProps) {
  return (
    <span
      key={pulseOnce ? tone : undefined}
      role="img"
      aria-label={label}
      title={label}
      className={cx(styles.dot, styles[tone], pulseOnce && styles.pulse)}
    />
  );
}
