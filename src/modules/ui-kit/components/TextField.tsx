import { useId } from 'react';
import { cx } from './cx';
import styles from './TextField.module.css';

export type TextFieldProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  /** Shown beneath the field when set; the field is marked invalid. */
  readonly invalidMessage?: string | null;
  readonly mono?: boolean;
  /** The accessible name when no visible label points at the field. */
  readonly label?: string;
  readonly disabled?: boolean;
};

/** A one-line text field (ui-kit.md "Components"). */
export function TextField({
  value,
  onChange,
  placeholder,
  invalidMessage,
  mono = false,
  label,
  disabled = false,
}: TextFieldProps) {
  const messageId = useId();
  const invalid = invalidMessage !== undefined && invalidMessage !== null && invalidMessage !== '';
  return (
    <span className={styles.field}>
      <input
        type="text"
        className={cx(styles.input, mono && styles.mono, invalid && styles.invalid)}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? messageId : undefined}
        disabled={disabled}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? (
        <span id={messageId} className={styles.message} role="alert">
          {invalidMessage}
        </span>
      ) : null}
    </span>
  );
}
