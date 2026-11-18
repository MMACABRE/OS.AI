import type { ProcessName } from '@hsos/contracts/channels/diagnostics';
import { Button } from './Button';
import styles from './PanelStates.module.css';
import { useUiKitActions } from './ui-kit-actions';

export type ErrorStateProps = {
  /** One sentence saying what failed. */
  readonly message: string;
  readonly onRetry?: () => void;
  /** The process whose log explains the failure; "Show log" opens the log folder. */
  readonly logProcess?: ProcessName | null;
  /** A settings shortcut, when a setting can fix the failure. */
  readonly settingsAction?: { readonly label: string; readonly onPress: () => void };
};

/** The error state: a danger title, one sentence, Retry and Show log (visual-direction.md "Panel states"). */
export function ErrorState({ message, onRetry, logProcess = null, settingsAction }: ErrorStateProps) {
  const actions = useUiKitActions();
  return (
    <div className={styles.error} role="alert">
      <h3 className={styles.errorTitle}>
        <span aria-hidden="true">!</span>
        Something stopped
      </h3>
      <p className={styles.line}>{message}</p>
      <div className={styles.actions}>
        {onRetry === undefined ? null : <Button onPress={onRetry}>Retry</Button>}
        {settingsAction === undefined ? null : (
          <Button variant="ghost" onPress={settingsAction.onPress}>
            {settingsAction.label}
          </Button>
        )}
        <button type="button" className={styles.link} onClick={() => actions.openLog(logProcess)}>
          Show log
        </button>
      </div>
    </div>
  );
}
