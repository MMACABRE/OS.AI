import { Fragment } from 'react';
import styles from './Kbd.module.css';

export type KbdProps = {
  /** A binding in the SET-19 format, for example `Ctrl+Shift+P` or the chord `Ctrl+K Ctrl+T`. */
  readonly binding: string;
};

function keysOf(part: string): string[] {
  if (part === '+') return ['+'];
  if (part.endsWith('++')) return [...part.slice(0, -2).split('+'), '+'];
  return part.split('+');
}

/** Renders a key binding as key caps (ui-kit.md "Components"). */
export function Kbd({ binding }: KbdProps) {
  const parts = binding.trim().split(/\s+/);
  return (
    <span className={styles.binding} aria-label={binding}>
      {parts.map((part, partIndex) => (
        <Fragment key={`${part}-${partIndex}`}>
          {partIndex > 0 ? <span className={styles.gap} aria-hidden="true" /> : null}
          {keysOf(part).map((key, keyIndex) => (
            <kbd key={`${key}-${keyIndex}`} className={styles.key} aria-hidden="true">
              {key}
            </kbd>
          ))}
        </Fragment>
      ))}
    </span>
  );
}
