import { useEffect, useState } from 'react';
import styles from './PanelStates.module.css';

/** The loading state appears only after this long, so fast loads never flash it (visual-direction.md). */
export const SKELETON_DELAY_MS = 150;

export type SkeletonProps = {
  readonly rows: number;
  /** What is loading, for example "Indexing notes". */
  readonly label?: string;
};

/** The loading state: after 150 ms, a cyan pixel bar, one line, and placeholder rows. No spinner. */
export function Skeleton({ rows, label = 'Loading' }: SkeletonProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return <div aria-busy="true" aria-label={label} />;
  return (
    <div className={styles.skeleton} aria-busy="true" role="status" aria-label={label}>
      <div className={styles.bar}>
        <div className={styles.barFill} />
      </div>
      <p className={styles.line}>{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
