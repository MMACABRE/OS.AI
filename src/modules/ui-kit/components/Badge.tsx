import { cx } from './cx';
import type { Tone } from './cx';
import styles from './Badge.module.css';

export type BadgeProps = {
  readonly tone: Tone | 'neutral';
  readonly text: string;
};

/** A short label in a tone's colour; the text carries the meaning, the colour repeats it. */
export function Badge({ tone, text }: BadgeProps) {
  return <span className={cx(styles.badge, styles[tone])}>{text}</span>;
}
