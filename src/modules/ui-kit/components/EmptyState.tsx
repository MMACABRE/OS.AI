import { Button } from './Button';
import styles from './PanelStates.module.css';

export type StateAction = { readonly label: string; readonly onPress: () => void };

export type EmptyStateProps = {
  /** One line saying what would appear here. */
  readonly message: string;
  /** A short title in the display font; defaults to "Nothing here yet". */
  readonly title?: string;
  readonly action?: StateAction;
  readonly secondaryAction?: StateAction;
};

/** The empty state: a title, one line, at most two actions; top-left aligned (P-40). */
export function EmptyState({
  message,
  title = 'Nothing here yet',
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.line}>{message}</p>
      {action === undefined && secondaryAction === undefined ? null : (
        <div className={styles.actions}>
          {action === undefined ? null : (
            <Button variant="primary" onPress={action.onPress}>
              {action.label}
            </Button>
          )}
          {secondaryAction === undefined ? null : (
            <Button onPress={secondaryAction.onPress}>{secondaryAction.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}
