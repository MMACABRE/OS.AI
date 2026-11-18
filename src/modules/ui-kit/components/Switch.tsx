import { cx } from './cx';
import styles from './Switch.module.css';

export type SwitchProps = {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  /** Hides the label text visually; it stays the accessible name. */
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
};

/** An on/off switch; Space and Enter toggle it (UI-2). */
export function Switch({ checked, onChange, label, hideLabel = false, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      className={cx(styles.switch, checked && styles.on)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {hideLabel ? null : <span>{label}</span>}
    </button>
  );
}
