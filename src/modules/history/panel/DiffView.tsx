import { useMemo } from 'react';
import { cls } from './format';
import { diffLines } from './line-diff';
import styles from './DiffView.module.css';

const SIGN = { same: ' ', added: '+', removed: '−' } as const;

export type DiffViewProps = {
  readonly before: string;
  readonly after: string;
};

/** Both versions of a file as one column of lines, changed lines tinted (UI-1 tokens, REV-20 style). */
export function DiffView({ before, after }: DiffViewProps) {
  const lines = useMemo(() => diffLines(before.split('\n'), after.split('\n')), [before, after]);
  if (lines === null) return <p className={styles.note}>This diff is too large to show.</p>;
  if (lines.every((line) => line.kind === 'same')) return <p className={styles.note}>No differences.</p>;
  return (
    <div className={styles.diff} aria-label="Difference">
      {lines.map((line, index) => (
        <div key={index} className={cls(styles.line, styles[line.kind])}>
          <span className={styles.sign} aria-hidden="true">
            {SIGN[line.kind]}
          </span>
          <span className={styles.text}>{line.text}</span>
        </div>
      ))}
    </div>
  );
}
