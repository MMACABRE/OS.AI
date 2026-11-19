import type { StatusItemDefinition } from '@hsos/contracts/module';
import styles from './Frame.module.css';

export type StatusBarProps = {
  readonly items: Iterable<StatusItemDefinition>;
  /** A plain line for the e2e checks of cards 005 and 010 (ping replies, port counts); hidden when empty. */
  readonly message: string;
};

const byOrder = (a: StatusItemDefinition, b: StatusItemDefinition) => a.order - b.order;

/** Registered status items, the project's on the left and Claude's on the right, by `order` (WS-32). */
export function StatusBar({ items, message }: StatusBarProps) {
  const all = [...items];
  const left = all.filter((item) => item.side === 'left').sort(byOrder);
  const right = all.filter((item) => item.side === 'right').sort(byOrder);
  return (
    <footer className={styles.statusBar} aria-label="Status bar">
      {left.map((item) => (
        <item.component key={item.id} />
      ))}
      {message === '' ? null : <span className={styles.message}>{message}</span>}
      <span className={styles.grow} />
      {right.reverse().map((item) => (
        <item.component key={item.id} />
      ))}
    </footer>
  );
}
