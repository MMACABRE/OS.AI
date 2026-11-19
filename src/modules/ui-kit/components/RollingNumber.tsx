import { useRef } from 'react';
import styles from './RollingNumber.module.css';

export type RollingNumberProps = {
  readonly value: number;
  /** Turns the value into its text, for example `(n) => `${n} %``. Defaults to `String`. */
  readonly format?: (value: number) => string;
};

const DIGIT = /[0-9]/;

/**
 * Which characters of `next` changed against `previous`, aligned from the right so units and
 * thousands stay put: `41 %` to `42 %` changes only the `2`.
 */
export function changedDigits(previous: string, next: string): readonly boolean[] {
  return [...next].map((char, index) => {
    const before = previous[previous.length - (next.length - index)];
    return DIGIT.test(char) && before !== char;
  });
}

/**
 * A number shown with tabular figures whose changed digits roll: the old digit slides up and out while
 * the new one slides in, over `motion.quick` (MOT-8). The whole value is the accessible text.
 */
export function RollingNumber({ value, format = String }: RollingNumberProps) {
  const text = format(value);
  const shown = useRef({ text, previous: text, version: 0 });
  if (shown.current.text !== text)
    shown.current = { text, previous: shown.current.text, version: shown.current.version + 1 };
  const { previous, version } = shown.current;
  const changed = changedDigits(previous, text);
  return (
    <span className={styles.number}>
      <span className={styles.hidden}>{text}</span>
      <span aria-hidden="true">
        {[...text].map((char, index) => {
          const fromRight = text.length - index;
          if (changed[index] !== true)
            return (
              <span key={`s${fromRight}`} className={styles.cell}>
                {char}
              </span>
            );
          const old = previous[previous.length - fromRight];
          return (
            <span key={`r${fromRight}-${version}`} className={styles.cell}>
              {old === undefined ? null : <span className={styles.out}>{old}</span>}
              <span className={styles.in}>{char}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
